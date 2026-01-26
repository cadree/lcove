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
  // Contact info - only available for own profile
  phone: string | null;
  social_links: SocialLinks | null;
}

export const useProfile = (userId?: string) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [targetUserId, isOwnProfile]);

  const fetchProfile = async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    
    let data: Record<string, unknown> | null = null;
    let error: Error | null = null;
    
    // Use profiles table for own profile (has access to phone), profiles_public for others
    if (isOwnProfile) {
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .single();
      data = result.data as Record<string, unknown> | null;
      error = result.error;
    } else {
      const result = await supabase
        .from('profiles_public')
        .select('*')
        .eq('user_id', targetUserId)
        .single();
      data = result.data as Record<string, unknown> | null;
      error = result.error;
    }

    if (!error && data) {
      const profileData: Profile = {
        id: data.id as string,
        user_id: data.user_id as string,
        display_name: data.display_name as string | null,
        city: data.city as string | null,
        city_display: data.city_display as string | null,
        city_key: data.city_key as string | null,
        bio: data.bio as string | null,
        avatar_url: data.avatar_url as string | null,
        passion_seriousness: data.passion_seriousness as number | null,
        access_level: data.access_level as Profile['access_level'],
        onboarding_completed: data.onboarding_completed as boolean | null,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        mindset_level: (data.mindset_level as number | null) ?? null,
        access_status: (data.access_status as Profile['access_status']) ?? 'pending',
        onboarding_score: (data.onboarding_score as number | null) ?? null,
        // Phone is only available for own profile (not in profiles_public view)
        phone: isOwnProfile ? ((data.phone as string | null) ?? null) : null,
        social_links: (data.social_links as SocialLinks | null) ?? null,
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
