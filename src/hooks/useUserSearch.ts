import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SearchedUser {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  social_links: {
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    tiktok?: string;
    website?: string;
  } | null;
}

export function useUserSearch(searchQuery: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      // Use profiles_public view to protect sensitive fields (phone)
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, user_id, display_name, avatar_url, city, bio, social_links')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      
      return (data || []) as SearchedUser[];
    },
    enabled: enabled && searchQuery.length >= 2,
    staleTime: 30000,
  });
}

export type { SearchedUser };
