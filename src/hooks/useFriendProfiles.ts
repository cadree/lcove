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
  const { data: friendProfiles = [], isLoading } = useQuery({
    queryKey: ['friend-profiles', friendIds],
    queryFn: async () => {
      if (friendIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, city, bio')
        .in('user_id', friendIds);

      if (error) throw error;
      return (data || []) as FriendProfile[];
    },
    enabled: friendIds.length > 0,
  });

  return {
    friendProfiles,
    isLoading,
  };
}
