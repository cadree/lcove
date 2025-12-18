import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorite-friends', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorite_friends')
        .select('friend_user_id')
        .eq('user_id', user.id);

      if (error) throw error;
      return data?.map(f => f.friend_user_id) || [];
    },
    enabled: !!user,
  });

  const addFavorite = useMutation({
    mutationFn: async (friendUserId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('favorite_friends')
        .insert({
          user_id: user.id,
          friend_user_id: friendUserId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-friends', user?.id] });
      toast.success('Added to favorites');
    },
    onError: () => {
      toast.error('Failed to add favorite');
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (friendUserId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('favorite_friends')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_user_id', friendUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-friends', user?.id] });
      toast.success('Removed from favorites');
    },
    onError: () => {
      toast.error('Failed to remove favorite');
    },
  });

  const isFavorite = (friendUserId: string) => favorites.includes(friendUserId);

  const toggleFavorite = (friendUserId: string) => {
    if (isFavorite(friendUserId)) {
      removeFavorite.mutate(friendUserId);
    } else {
      addFavorite.mutate(friendUserId);
    }
  };

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}
