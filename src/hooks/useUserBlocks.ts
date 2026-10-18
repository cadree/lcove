import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useUserBlocks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      if (!user) return { blockedIds: [] as string[], profiles: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };

      const { data: blocks, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (error) throw error;

      const blockedIds = blocks?.map(b => b.blocked_id) || [];
      if (blockedIds.length === 0) return { blockedIds, profiles: [] };

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', blockedIds);

      return { blockedIds, profiles: profiles || [] };
    },
    enabled: !!user,
  });

  const blockedIds = useMemo(() => data?.blockedIds ?? [], [data?.blockedIds]);
  const blockedUsers = data?.profiles ?? [];

  const blockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: blockedId });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBlockViews(queryClient);
      toast.success('User blocked');
    },
  });

  const unblockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBlockViews(queryClient);
      toast.success('User unblocked');
    },
  });

  const isBlocked = useCallback((userId: string) => {
    return blockedIds.includes(userId);
  }, [blockedIds]);

  return {
    blockedUsers,
    blockedIds,
    isLoading,
    blockUser,
    unblockUser,
    isBlocked,
  };
}

function invalidateBlockViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
  queryClient.invalidateQueries({ queryKey: ['posts'] });
  queryClient.invalidateQueries({ queryKey: ['post-comments'] });
  queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  queryClient.invalidateQueries({ queryKey: ['messages'] });
  queryClient.invalidateQueries({ queryKey: ['user-search'] });
  queryClient.invalidateQueries({ queryKey: ['all-users'] });
  queryClient.invalidateQueries({ queryKey: ['community-portfolio-posts'] });
}
