import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import OnboardingIntro from '@/components/onboarding/OnboardingIntro';
import OnboardingPassions from '@/components/onboarding/OnboardingPassions';
import OnboardingCity from '@/components/onboarding/OnboardingCity';
import OnboardingSkills from '@/components/onboarding/OnboardingSkills';
import OnboardingRoles from '@/components/onboarding/OnboardingRoles';
import OnboardingQuestionnaire from '@/components/onboarding/OnboardingQuestionnaire';
import OnboardingConnections from '@/components/onboarding/OnboardingConnections';
import OnboardingCompletion from '@/components/onboarding/OnboardingCompletion';
import OnboardingDenied from '@/components/onboarding/OnboardingDenied';
import OnboardingProfile from '@/components/onboarding/OnboardingProfile';

export interface OnboardingData {
  displayName: string;
  phone: string;
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

  // Initialize step based on profile state - if already completed, start at connections step
  const [currentStep, setCurrentStep] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    phone: '',
    passions: [],
    passionSeriousness: 5,
    city: '',
    cityDisplay: '',
    cityKey: '',
    skills: [],
    roles: [],
    questionnaireResponses: {},
  });
  const [accessLevel, setAccessLevel] = useState<'level_1' | 'level_2' | 'level_3' | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Handle redirect for completed onboarding users - redirect to feed, not restart
  useEffect(() => {
    if (!profileLoading && !initialized && profile) {
      setInitialized(true);
      
      if (profile.onboarding_completed) {
        // If onboarding is already complete, redirect to feed (don't restart)
        if (profile.access_status === 'denied' || profile.access_level === 'level_1') {
          navigate('/locked');
        } else {
          navigate('/feed');
        }
      }
    }
  }, [profile, profileLoading, initialized, navigate]);

  // Scoring: A=1, B=2, C=3 points per question
  // Threshold: >= 20 points (out of 30 max for 10 questions) = Level 2 (Accepted)
  // Below 20 = Level 1 (Denied)
  const ACCEPTANCE_THRESHOLD = 20;

  const calculateMindsetLevel = (responses: Record<number, 'A' | 'B' | 'C'>): { level: 1 | 2; score: number } => {
    const score = Object.values(responses).reduce((sum, ans) => {
      return sum + (ans === 'A' ? 1 : ans === 'B' ? 2 : 3);
    }, 0);
    
    // Level 2 = Accepted (score >= threshold), Level 1 = Denied
    const level = score >= ACCEPTANCE_THRESHOLD ? 2 : 1;
    return { level, score };
  };

  const handleComplete = async () => {
    if (!user) return;

    const { level, score } = calculateMindsetLevel(data.questionnaireResponses);
    setAccessLevel(level === 2 ? 'level_2' : 'level_1');

    try {
      // Save questionnaire responses
      await supabase.from('questionnaire_responses').upsert({
        user_id: user.id,
        responses: data.questionnaireResponses,
        total_score: score,
      }, { onConflict: 'user_id' });

      // Save passions
      const { data: passions } = await supabase
        .from('passions')
        .select('id, name')
        .in('name', data.passions);

      if (passions && passions.length > 0) {
        await supabase.from('user_passions').upsert(
          passions.map((p) => ({ user_id: user.id, passion_id: p.id })),
          { onConflict: 'user_id,passion_id' }
        );
      }

      // Save skills
      const { data: skills } = await supabase
        .from('skills')
        .select('id, name')
        .in('name', data.skills);

      if (skills && skills.length > 0) {
        await supabase.from('user_skills').upsert(
          skills.map((s) => ({ user_id: user.id, skill_id: s.id })),
          { onConflict: 'user_id,skill_id' }
        );
      }

      // Save creative roles
      const { data: roles } = await supabase
        .from('creative_roles')
        .select('id, name')
        .in('name', data.roles);

      if (roles && roles.length > 0) {
        await supabase.from('user_creative_roles').upsert(
          roles.map((r) => ({ user_id: user.id, role_id: r.id })),
          { onConflict: 'user_id,role_id' }
        );
      }

      // Determine access status based on mindset level
      const accessStatus = level === 2 ? 'active' : 'denied';

      // Set session flag to prevent AccessGate from redirecting back during navigation
      sessionStorage.setItem('onboarding_just_completed', 'true');

      // Update profile with all onboarding data (including normalized city fields and display name)
      await updateProfile({
        display_name: data.displayName,
        city: data.city,
        city_display: data.cityDisplay,
        city_key: data.cityKey,
        passion_seriousness: data.passionSeriousness,
        access_level: level === 2 ? 'level_2' : 'level_1',
        onboarding_completed: true,
        mindset_level: level,
        access_status: accessStatus,
        onboarding_score: score,
      });

      // Save phone number separately (not in Profile type yet)
      if (data.phone) {
        await supabase.from('profiles').update({ phone: data.phone }).eq('user_id', user.id);
      }

      if (level === 1) {
        setCurrentStep(9); // Show denied screen
      } else {
        setCurrentStep(7); // Show connections screen (optional step)
      }
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast({
        title: 'Error saving data',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setCurrentStep((prev) => prev + 1);
  const prevStep = () => setCurrentStep((prev) => Math.max(0, prev - 1));

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
    <OnboardingIntro key="intro" onNext={nextStep} />,
    <OnboardingProfile key="profile" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingPassions key="passions" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingCity key="city" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingSkills key="skills" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingRoles key="roles" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingQuestionnaire key="questionnaire" data={data} updateData={updateData} onComplete={handleComplete} onBack={prevStep} />,
    <OnboardingConnections key="connections" onComplete={() => setCurrentStep(8)} onBack={prevStep} />,
    <OnboardingCompletion key="completion" accessLevel={accessLevel} />,
    <OnboardingDenied key="denied" />,
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
