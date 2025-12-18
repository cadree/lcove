import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  passion_seriousness: number | null;
  access_level: 'level_1' | 'level_2' | 'level_3' | null;
  onboarding_completed: boolean | null;
  created_at: string;
  updated_at: string;
}

export const useProfile = (userId?: string) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [targetUserId]);

  const fetchProfile = async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
    setLoading(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      await fetchProfile();
    }

    return { error };
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
};
