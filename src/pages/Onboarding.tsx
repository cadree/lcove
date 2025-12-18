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

export interface OnboardingData {
  passions: string[];
  passionSeriousness: number;
  city: string;
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
  const [data, setData] = useState<OnboardingData>({
    passions: [],
    passionSeriousness: 5,
    city: '',
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

  useEffect(() => {
    if (!profileLoading && profile?.onboarding_completed) {
      if (profile.access_level === 'level_1') {
        navigate('/denied');
      } else {
        navigate('/feed');
      }
    }
  }, [profile, profileLoading, navigate]);

  const calculateAccessLevel = (responses: Record<number, 'A' | 'B' | 'C'>) => {
    const scores = { A: 0, B: 0, C: 0 };
    Object.values(responses).forEach((answer) => {
      scores[answer]++;
    });

    if (scores.A >= 5) return 'level_1';
    if (scores.C >= 5) return 'level_3';
    return 'level_2';
  };

  const handleComplete = async () => {
    if (!user) return;

    const level = calculateAccessLevel(data.questionnaireResponses);
    setAccessLevel(level);

    try {
      // Save questionnaire responses
      const totalScore = Object.values(data.questionnaireResponses).reduce((sum, ans) => {
        return sum + (ans === 'A' ? 1 : ans === 'B' ? 2 : 3);
      }, 0);

      await supabase.from('questionnaire_responses').insert({
        user_id: user.id,
        responses: data.questionnaireResponses,
        total_score: totalScore,
      });

      // Save passions
      const { data: passions } = await supabase
        .from('passions')
        .select('id, name')
        .in('name', data.passions);

      if (passions) {
        await supabase.from('user_passions').insert(
          passions.map((p) => ({ user_id: user.id, passion_id: p.id }))
        );
      }

      // Save skills
      const { data: skills } = await supabase
        .from('skills')
        .select('id, name')
        .in('name', data.skills);

      if (skills) {
        await supabase.from('user_skills').insert(
          skills.map((s) => ({ user_id: user.id, skill_id: s.id }))
        );
      }

      // Save creative roles
      const { data: roles } = await supabase
        .from('creative_roles')
        .select('id, name')
        .in('name', data.roles);

      if (roles) {
        await supabase.from('user_creative_roles').insert(
          roles.map((r) => ({ user_id: user.id, role_id: r.id }))
        );
      }

      // Update profile
      await updateProfile({
        city: data.city,
        passion_seriousness: data.passionSeriousness,
        access_level: level,
        onboarding_completed: true,
      });

      if (level === 'level_1') {
        setCurrentStep(8); // Show denied screen
      } else {
        setCurrentStep(6); // Show connections screen (optional step)
      }
    } catch (error) {
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
    <OnboardingPassions key="passions" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingCity key="city" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingSkills key="skills" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingRoles key="roles" data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />,
    <OnboardingQuestionnaire key="questionnaire" data={data} updateData={updateData} onComplete={handleComplete} onBack={prevStep} />,
    <OnboardingConnections key="connections" onComplete={() => setCurrentStep(7)} onBack={prevStep} />,
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
