import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SHOT_USER_ID, shotProfile, shotSessionEnabled } from '@/lib/shotSession';

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
  // Own profile only. Never copied from another member's row.
  passed_exam: boolean;
  show_only_to_passed_exam: boolean;
  // Contact info - only available for own profile
  phone: string | null;
  social_links: SocialLinks | null;
  founding: boolean;
}

export const useProfile = (userId?: string) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;

    if (shotSessionEnabled() && targetUserId === SHOT_USER_ID) {
      setProfile(shotProfile);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    let data: Record<string, unknown> | null = null;
    let error: Error | null = null;
    
    // Own row includes phone and the exam score. Other members come from
    // profiles_public, which omits both.
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
        .select('id, user_id, display_name, city, city_display, city_key, bio, avatar_url, passion_seriousness, access_level, onboarding_completed, created_at, updated_at, mindset_level, access_status, social_links, founding')
        .eq('user_id', targetUserId)
        .maybeSingle();
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
        onboarding_score: isOwnProfile ? ((data.onboarding_score as number | null) ?? null) : null,
        passed_exam: isOwnProfile ? Boolean(data.passed_exam) : false,
        show_only_to_passed_exam: isOwnProfile ? Boolean(data.show_only_to_passed_exam) : false,
        phone: isOwnProfile ? ((data.phone as string | null) ?? null) : null,
        social_links: (data.social_links as SocialLinks | null) ?? null,
        founding: Boolean(data.founding),
      };
      setProfile(profileData);
    } else if (!isOwnProfile) {
      setProfile(null);
    }
    setLoading(false);
  }, [targetUserId, isOwnProfile]);

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [targetUserId, fetchProfile]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('user_id', user.id);

    if (!error) {
      await fetchProfile();
    }

    return { error };
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
};
