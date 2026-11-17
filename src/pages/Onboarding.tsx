import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { identityFromMetadata } from '@/lib/pendingSignup';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import OnboardingName from '@/components/onboarding/OnboardingName';
import OnboardingPassions from '@/components/onboarding/OnboardingPassions';
import OnboardingCity from '@/components/onboarding/OnboardingCity';
import OnboardingPledge from '@/components/onboarding/OnboardingPledge';
import OnboardingProof from '@/components/onboarding/OnboardingProof';
import { applicantLinksError, normalizeApplicantLink } from '@/lib/applicantLinks';
import { buildUserPassionInserts } from '@/lib/onboardingPassions';
import { memberOfError, normalizeMemberOf } from '@/lib/etherId';
import { assertCleanText } from '@/lib/objectionableText';
import { scoreRedFlags, clearQuizSeed, type ChoiceId } from '@/lib/onboardingQuiz';
import { clearOnboardingDraft, readOnboardingDraft, writeOnboardingDraft } from '@/lib/onboardingDraft';
import { takeEventReturn } from '../../functions/_shared/eventShare.js';
import { accessPath } from '@/lib/accessPath';
import { uploadAvatar } from '@/lib/avatarUpload';

export interface OnboardingData {
  displayName: string;
  memberOf: string;
  passions: string[];
  passionSeriousness: number;
  city: string;
  cityDisplay: string;
  cityKey: string;
  socialProfile: string;
  website: string;
  skills: string[];
  roles: string[];
  questionnaireResponses: Record<number, 'A' | 'B' | 'C'>;
}

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  // The photo stays in memory (drafts are text only) and uploads when onboarding finishes.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveErrorToast = useRef<{ dismiss: () => void } | null>(null);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    memberOf: '',
    passions: [],
    passionSeriousness: 5,
    city: '',
    cityDisplay: '',
    cityKey: '',
    socialProfile: '',
    website: '',
    skills: [],
    roles: [],
    questionnaireResponses: {}
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Pre-fill name from profile if the field is still empty. displayName is read
  // from a ref so typing in the field does not re-run this effect.
  const displayNameRef = useRef(data.displayName);
  displayNameRef.current = data.displayName;
  const memberOfRef = useRef(data.memberOf);
  memberOfRef.current = data.memberOf;
  useEffect(() => {
    const fromMeta = identityFromMetadata(user?.user_metadata);
    if (!displayNameRef.current) {
      const nextName = profile?.display_name || fromMeta.displayName || '';
      if (nextName) setData(prev => ({ ...prev, displayName: nextName }));
    }
    if (!memberOfRef.current) {
      const nextMember = profile?.member_of || fromMeta.memberOf || '';
      if (nextMember) setData(prev => ({ ...prev, memberOf: nextMember }));
    }
  }, [profile, user]);

  // Resume a mid-onboarding refresh. Completed profiles still go to the feed.
  useEffect(() => {
    if (authLoading || profileLoading || initialized || !user) return;
    setInitialized(true);
    if (profile?.onboarding_completed) {
      clearOnboardingDraft(window.localStorage, user.id);
      const next = accessPath(
        { onboarding_completed: true, access_status: profile.access_status },
        '/onboarding',
      );
      const hold = next === '/pending' || next === '/denied' || next === '/locked';
      // An already-verified member who resumes a previous signup must not
      // loop on /onboarding; /welcome checks for their approval event.
      const afterApproval = profile.access_status === "active" ? "/welcome" : next;
      navigate(hold ? next : (takeEventReturn() || afterApproval), { replace: true });
      return;
    }
    const draft = readOnboardingDraft(window.localStorage, user.id);
    if (draft) {
      setCurrentStep(draft.step);
      setData(draft.data);
    }
  }, [authLoading, profile, profileLoading, initialized, navigate, user]);

  useEffect(() => {
    if (!user || !initialized || profile?.onboarding_completed) return;
    writeOnboardingDraft(window.localStorage, user.id, { step: currentStep, data });
  }, [user, initialized, profile?.onboarding_completed, currentStep, data]);

  const calculateMindsetLevel = (responses: Record<number, ChoiceId>): {
    level: 1 | 2;
    score: number;
    passed: boolean;
  } => {
    const result = scoreRedFlags(responses);
    return { level: result.level, score: result.score, passed: result.passed };
  };

  const handleComplete = async () => {
    if (!user || saving) return;
    saveErrorToast.current?.dismiss();
    saveErrorToast.current = null;
    setSaving(true);

    // Final validation - name is required
    if (!data.displayName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please go back and enter your name to complete onboarding.',
        variant: 'destructive'
      });
      setCurrentStep(0);
      setSaving(false);
      return;
    }

    const memberError = memberOfError(data.memberOf);
    if (memberError) {
      toast({ title: 'Member of', description: memberError, variant: 'destructive' });
      setCurrentStep(0);
      setSaving(false);
      return;
    }

    const reviewError = applicantLinksError(data.socialProfile, data.website);
    if (reviewError) {
      toast({ title: 'Review link required', description: reviewError, variant: 'destructive' });
      setCurrentStep(3);
      setSaving(false);
      return;
    }

    if (!data.socialProfile.trim() && !(user.email && user.email_confirmed_at)) {
      toast({ title: 'Email verification required', description: 'Verify your account email before submitting a website-only application.', variant: 'destructive' });
      setCurrentStep(3);
      setSaving(false);
      return;
    }

    const { level, score, passed: passedExam } = calculateMindsetLevel(data.questionnaireResponses);

    try {
      // Save questionnaire responses
      await supabase.from('questionnaire_responses').upsert({
        user_id: user.id,
        responses: data.questionnaireResponses,
        total_score: score
      }, { onConflict: 'user_id' });

      // Seeded names link to passions.id. Typed names that are not in the
      // catalog are stored as custom_name. Replace this user's rows so a
      // retry cannot leave only the first matching seed.
      const { data: passionCatalog, error: passionCatalogError } = await supabase
        .from('passions')
        .select('id, name');
      if (passionCatalogError) throw passionCatalogError;
      const passionRows = buildUserPassionInserts(user.id, data.passions, passionCatalog ?? []);
      const { error: clearPassionsError } = await supabase
        .from('user_passions')
        .delete()
        .eq('user_id', user.id);
      if (clearPassionsError) throw clearPassionsError;
      if (passionRows.length > 0) {
        const { error } = await supabase.from('user_passions').insert(passionRows);
        if (error) throw error;
      }

      // Tools and roles are no longer asked. A resumed draft can still save
      // values the person already chose. Empty lists skip the query.
      if (data.skills.length > 0) {
        const { data: skills } = await supabase
          .from('skills')
          .select('id, name')
          .in('name', data.skills);
        if (skills && skills.length > 0) {
          await supabase.from('user_skills').upsert(
            skills.map(s => ({ user_id: user.id, skill_id: s.id })),
            { onConflict: 'user_id,skill_id' }
          );
        }
      }

      if (data.roles.length > 0) {
        const { data: roles } = await supabase
          .from('creative_roles')
          .select('id, name')
          .in('name', data.roles);
        if (roles && roles.length > 0) {
          await supabase.from('user_creative_roles').upsert(
            roles.map(r => ({ user_id: user.id, role_id: r.id })),
            { onConflict: 'user_id,role_id' }
          );
        }
      }

      // Access stays pending until a human approves entry. passed_exam records
      // whether the red-flag count stayed under the threshold.
      assertCleanText(data.memberOf);
      let avatarUrl: string | null = null;
      if (avatarFile) {
        try {
          avatarUrl = await uploadAvatar(user.id, avatarFile);
        } catch {
          toast({ title: 'Photo not saved', description: 'You can add one from your profile.' });
        }
      }
      const { error: profileError } = await updateProfile({
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        display_name: data.displayName.trim(),
        member_of: normalizeMemberOf(data.memberOf),
        social_links: {
          ...(profile?.social_links ?? {}),
          social_profile: normalizeApplicantLink(data.socialProfile) || '',
          website: normalizeApplicantLink(data.website) || '',
        },
        city: data.city,
        city_display: data.cityDisplay,
        city_key: data.cityKey,
        passion_seriousness: data.passionSeriousness,
        access_level: passedExam ? 'level_2' : 'level_1',
        onboarding_completed: true,
        mindset_level: level,
        onboarding_level: level,
        access_status: 'pending',
        onboarding_score: score,
        passed_exam: passedExam,
      });

      if (profileError) throw profileError;
      clearQuizSeed(window.sessionStorage);
      clearOnboardingDraft(window.localStorage, user.id);

      // A human still has to approve access. The pending screen is the next step.
      navigate(takeEventReturn() || '/pending', { replace: true });
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      saveErrorToast.current = toast({
        title: 'Error saving data',
        description: 'Please try again.',
        variant: 'destructive'
      });
      setSaving(false);
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => Math.max(0, prev - 1));

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"
        />
      </div>
    );
  }

  const steps = [
    <OnboardingName
      key="name"
      displayName={data.displayName}
      memberOf={data.memberOf}
      updateName={(name) => updateData({ displayName: name })}
      updateMemberOf={(memberOf) => updateData({ memberOf })}
      onNext={nextStep}
      nameLocked={Boolean((profile?.display_name || identityFromMetadata(user?.user_metadata).displayName || '').trim())}
      avatarPreview={avatarPreview}
      onAvatar={setAvatarFile}
    />,
    <OnboardingPassions key="passions" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingCity key="city" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingProof key="review-links" socialProfile={data.socialProfile} website={data.website}
      verifiedEmail={user?.email && user.email_confirmed_at ? user.email : null}
      updateLinks={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingPledge key="pledge" onComplete={() => void handleComplete()} onBack={prevStep} submitting={saving} />,
  ];

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {steps[currentStep]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;