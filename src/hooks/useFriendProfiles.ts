import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FriendProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
}

export function useFriendProfiles(friendIds: string[]) {
  const { data: friendProfiles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['friend-profiles', friendIds],
    queryFn: async () => {
      if (friendIds.length === 0) return [];

      console.log('[useFriendProfiles] Fetching profiles for', friendIds.length, 'friends');

      // Use profiles_public view to protect sensitive fields (phone)
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, city, bio')
        .in('user_id', friendIds);

      if (error) {
        console.error('[useFriendProfiles] Error fetching profiles:', error);
        throw error;
      }
      
      console.log('[useFriendProfiles] Successfully fetched', data?.length || 0, 'profiles');
      return (data || []) as FriendProfile[];
    },
    enabled: friendIds.length > 0,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    friendProfiles,
    isLoading,
    error,
    refetch,
  };
}
