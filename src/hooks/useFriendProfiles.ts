import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { abortAfter } from '@/lib/requestDeadline';
import { shotPeople, shotSessionEnabled } from '@/lib/shotSession';

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
      if (shotSessionEnabled()) {
        const wanted = new Set(friendIds);
        return shotPeople
          .filter((person) => wanted.has(person.user_id))
          .map((person) => ({ ...person, bio: null })) as FriendProfile[];
      }

      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, city, bio')
        .in('user_id', friendIds)
        .abortSignal(abortAfter());

      if (error) throw error;
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
