import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  website?: string;
  [key: string]: string | undefined;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  city: string | null;
  city_display: string | null;
  city_key: string | null;
  bio: string | null;
  avatar_url: string | null;
  passion_seriousness: number | null;
  access_level: 'level_1' | 'level_2' | 'level_3' | null;
  onboarding_completed: boolean | null;
  created_at: string;
  updated_at: string;
  // Mindset gate fields
  mindset_level: number | null;
  access_status: 'pending' | 'active' | 'denied' | 'banned' | null;
  onboarding_score: number | null;
  // Contact info
  phone: string | null;
  social_links: SocialLinks | null;
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
      // Cast data and provide defaults for fields that might not exist in DB yet
      const rawData = data as Record<string, unknown>;
      const profileData: Profile = {
        id: rawData.id as string,
        user_id: rawData.user_id as string,
        display_name: rawData.display_name as string | null,
        city: rawData.city as string | null,
        city_display: rawData.city_display as string | null,
        city_key: rawData.city_key as string | null,
        bio: rawData.bio as string | null,
        avatar_url: rawData.avatar_url as string | null,
        passion_seriousness: rawData.passion_seriousness as number | null,
        access_level: rawData.access_level as Profile['access_level'],
        onboarding_completed: rawData.onboarding_completed as boolean | null,
        created_at: rawData.created_at as string,
        updated_at: rawData.updated_at as string,
        mindset_level: (rawData.mindset_level as number | null) ?? null,
        access_status: (rawData.access_status as Profile['access_status']) ?? 'pending',
        onboarding_score: (rawData.onboarding_score as number | null) ?? null,
        phone: (rawData.phone as string | null) ?? null,
        social_links: (rawData.social_links as SocialLinks | null) ?? null,
      };
      setProfile(profileData);
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
