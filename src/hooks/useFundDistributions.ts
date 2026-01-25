import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type FundCategory = 
  | 'community_grants'
  | 'events_activations'
  | 'education'
  | 'infrastructure'
  | 'operations';

export interface FundDistribution {
  id: string;
  category: FundCategory;
  amount: number;
  title: string;
  description: string | null;
  recipient_name: string | null;
  recipient_id: string | null;
  proof_url: string | null;
  distributed_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDistributionInput {
  category: FundCategory;
  amount: number;
  title: string;
  description?: string;
  recipient_name?: string;
  recipient_id?: string;
  proof_url?: string;
  distributed_at?: string;
}

export function useFundDistributions() {
  const queryClient = useQueryClient();

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('fund-distributions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fund_distributions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fund-distributions'] });
          queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['fund-distributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fund_distributions')
        .select('*')
        .order('distributed_at', { ascending: false });

      if (error) throw error;
      return data as FundDistribution[];
    },
    staleTime: 30000,
  });
}

export function useFundDistributionsByCategory() {
  const { data: distributions, isLoading } = useFundDistributions();

  const byCategory = distributions?.reduce((acc, dist) => {
    if (!acc[dist.category]) {
      acc[dist.category] = [];
    }
    acc[dist.category].push(dist);
    return acc;
  }, {} as Record<FundCategory, FundDistribution[]>) || {};

  const totals = {
    community_grants: distributions?.filter(d => d.category === 'community_grants').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
    events_activations: distributions?.filter(d => d.category === 'events_activations').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
    education: distributions?.filter(d => d.category === 'education').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
    infrastructure: distributions?.filter(d => d.category === 'infrastructure').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
    operations: distributions?.filter(d => d.category === 'operations').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
  };

  const totalDistributed = Object.values(totals).reduce((sum, val) => sum + val, 0);

  return {
    distributions,
    byCategory,
    totals,
    totalDistributed,
    isLoading,
  };
}

export function useCreateDistribution() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateDistributionInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('fund_distributions')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-distributions'] });
      queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
      toast.success('Distribution recorded successfully');
    },
    onError: (error) => {
      console.error('Error creating distribution:', error);
      toast.error('Failed to record distribution');
    },
  });
}

export function useUpdateDistribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FundDistribution> & { id: string }) => {
      const { data, error } = await supabase
        .from('fund_distributions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-distributions'] });
      queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
      toast.success('Distribution updated');
    },
    onError: (error) => {
      console.error('Error updating distribution:', error);
      toast.error('Failed to update distribution');
    },
  });
}

export function useDeleteDistribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fund_distributions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-distributions'] });
      queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
      toast.success('Distribution deleted');
    },
    onError: (error) => {
      console.error('Error deleting distribution:', error);
      toast.error('Failed to delete distribution');
    },
  });
}

export function useRecentDistributions(limit = 10) {
  return useQuery({
    queryKey: ['fund-distributions', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fund_distributions')
        .select(`
          *,
          recipient:profiles!fund_distributions_recipient_id_fkey(display_name, avatar_url)
        `)
        .order('distributed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    staleTime: 30000,
  });
}
