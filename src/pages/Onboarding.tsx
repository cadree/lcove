import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import OnboardingName from '@/components/onboarding/OnboardingName';
import OnboardingPassions from '@/components/onboarding/OnboardingPassions';
import OnboardingCity from '@/components/onboarding/OnboardingCity';
import OnboardingQuestionnaire from '@/components/onboarding/OnboardingQuestionnaire';
import { buildUserPassionInserts } from '@/lib/onboardingPassions';
import { scoreRedFlags, clearQuizSeed, type ChoiceId } from '@/lib/onboardingQuiz';
import { clearOnboardingDraft, readOnboardingDraft, writeOnboardingDraft } from '@/lib/onboardingDraft';
import { takeEventReturn } from '../../functions/_shared/eventShare.js';

export interface OnboardingData {
  displayName: string;
  passions: string[];
  passionSeriousness: number;
  city: string;
  cityDisplay: string;
  cityKey: string;
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
  const [initialized, setInitialized] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    passions: [],
    passionSeriousness: 5,
    city: '',
    cityDisplay: '',
    cityKey: '',
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
  useEffect(() => {
    if (profile?.display_name && !displayNameRef.current) {
      setData(prev => ({ ...prev, displayName: profile.display_name || '' }));
    }
  }, [profile]);

  // Resume a mid-onboarding refresh. Completed profiles still go to the feed.
  useEffect(() => {
    if (authLoading || profileLoading || initialized || !user) return;
    setInitialized(true);
    if (profile?.onboarding_completed && profile.access_status !== 'banned') {
      clearOnboardingDraft(window.localStorage, user.id);
      navigate(takeEventReturn() || '/feed');
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
    if (!user) return;

    // Final validation - name is required
    if (!data.displayName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please go back and enter your name to complete onboarding.',
        variant: 'destructive'
      });
      setCurrentStep(0);
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

      sessionStorage.setItem('onboarding_just_completed', 'true');
      clearQuizSeed(window.sessionStorage);
      clearOnboardingDraft(window.localStorage, user.id);

      // Finishing onboarding always grants access. passed_exam records
      // whether the red-flag count stayed under the threshold.
      await updateProfile({
        display_name: data.displayName.trim(),
        city: data.city,
        city_display: data.cityDisplay,
        city_key: data.cityKey,
        passion_seriousness: data.passionSeriousness,
        access_level: passedExam ? 'level_2' : 'level_1',
        onboarding_completed: true,
        mindset_level: level,
        onboarding_level: level,
        access_status: 'active',
        onboarding_score: score,
        passed_exam: passedExam,
      });

      navigate(takeEventReturn() || '/feed', { replace: true });
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast({
        title: 'Error saving data',
        description: 'Please try again.',
        variant: 'destructive'
      });
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
      updateName={(name) => updateData({ displayName: name })}
      onNext={nextStep}
    />,
    <OnboardingPassions key="passions" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingCity key="city" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingQuestionnaire key="questionnaire" data={data} updateData={updateData} onComplete={handleComplete} onBack={prevStep} />,
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