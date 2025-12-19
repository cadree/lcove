import { useProfile } from '@/hooks/useProfile';

export type AccessStatus = 'pending' | 'active' | 'denied' | 'banned';

export const useAccessStatus = () => {
  const { profile, loading } = useProfile();

  const accessStatus: AccessStatus = (profile?.access_status as AccessStatus) || 'pending';
  const mindsetLevel = profile?.mindset_level || null;
  const onboardingCompleted = profile?.onboarding_completed || false;
  const onboardingScore = profile?.onboarding_score || null;

  const isBlocked = accessStatus === 'denied' || accessStatus === 'banned';
  const isActive = accessStatus === 'active';
  const isPending = accessStatus === 'pending';

  return {
    accessStatus,
    mindsetLevel,
    onboardingCompleted,
    onboardingScore,
    isBlocked,
    isActive,
    isPending,
    loading,
  };
};
