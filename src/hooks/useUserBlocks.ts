import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useUserBlocks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: blockedUsers = [], isLoading } = useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (error) throw error;

      const blockedIds = data?.map(b => b.blocked_id) || [];
      
      if (blockedIds.length === 0) return [];

      // Use profiles_public view to protect sensitive fields
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', blockedIds);

      return profiles || [];
    },
    enabled: !!user,
  });

  const blockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: blockedId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
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
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      toast.success('User unblocked');
    },
  });

  const isBlocked = useCallback((userId: string) => {
    return blockedUsers.some(b => b.user_id === userId);
  }, [blockedUsers]);

  return {
    blockedUsers,
    isLoading,
    blockUser,
    unblockUser,
    isBlocked,
  };
}
