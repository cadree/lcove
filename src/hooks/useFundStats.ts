import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

type FundSnapshot = { collected: number; member_count: number };

/** Aggregate-only read. Row policies hide other members' membership rows. */
async function fundSnapshot(start?: string, end?: string): Promise<FundSnapshot> {
  const args: { p_start?: string; p_end?: string } = {};
  if (start) args.p_start = start;
  if (end) args.p_end = end;
  const { data, error } = await supabase.rpc(
    'membership_fund_snapshot' as never,
    args as never,
  );
  if (error) throw error;
  const row = (data ?? {}) as Partial<FundSnapshot>;
  return {
    collected: Number(row.collected ?? 0),
    member_count: Number(row.member_count ?? 0),
  };
}

export interface FundStats {
  lifetime: {
    totalCollected: number;
    totalDistributed: number;
    grantsAwarded: number;
    creatorsSupported: number;
    memberCount: number;
  };
  monthly: {
    totalCollected: number;
    totalDistributed: number;
    grantsAwarded: number;
    creatorsSupported: number;
    memberCount: number;
  };
  monthlyTrend: Array<{
    month: string;
    collected: number;
    distributed: number;
  }>;
  allocations: {
    communityGrants: number;
    eventsActivations: number;
    education: number;
    infrastructure: number;
    operations: number;
  };
  recentDistributions: Array<{
    id: string;
    category: string;
    amount: number;
    title: string;
    recipient_name: string | null;
    distributed_at: string;
  }>;
}

export function useFundStats() {
  const queryClient = useQueryClient();

  // Set up real-time subscription for both contributions and distributions
  useEffect(() => {
    const channel = supabase
      .channel('fund-stats-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'membership_contributions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memberships'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fund_distributions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fund-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['fund-stats'],
    queryFn: async (): Promise<FundStats> => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      const lifetimeSnapshot = await fundSnapshot();
      const lifetimeTotalCollected = lifetimeSnapshot.collected;
      
      // Get REAL distribution data from fund_distributions table
      const { data: allDistributions } = await supabase
        .from('fund_distributions')
        .select('*');

      // Calculate actual allocations from real data
      const allocations = {
        communityGrants: allDistributions?.filter(d => d.category === 'community_grants').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
        eventsActivations: allDistributions?.filter(d => d.category === 'events_activations').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
        education: allDistributions?.filter(d => d.category === 'education').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
        infrastructure: allDistributions?.filter(d => d.category === 'infrastructure').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
        operations: allDistributions?.filter(d => d.category === 'operations').reduce((sum, d) => sum + Number(d.amount), 0) || 0,
      };

      const lifetimeTotalDistributed = Object.values(allocations).reduce((sum, val) => sum + val, 0);

      // Count grants awarded (distinct distributions in community_grants category)
      const grantsAwarded = allDistributions?.filter(d => d.category === 'community_grants').length || 0;

      // Unique recipients as "creators supported"
      const uniqueRecipients = new Set(
        allDistributions?.filter(d => d.recipient_id || d.recipient_name).map(d => d.recipient_id || d.recipient_name)
      );

      const memberCount = lifetimeSnapshot.member_count;

      const monthlySnapshot = await fundSnapshot(monthStart, monthEnd);
      const monthlyTotalCollected = monthlySnapshot.collected;

      // Monthly distributions
      const { data: monthlyDistributions } = await supabase
        .from('fund_distributions')
        .select('*')
        .gte('distributed_at', monthStart)
        .lte('distributed_at', monthEnd);

      const monthlyTotalDistributed = monthlyDistributions?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
      const monthlyGrantsAwarded = monthlyDistributions?.filter(d => d.category === 'community_grants').length || 0;
      const monthlyUniqueRecipients = new Set(
        monthlyDistributions?.filter(d => d.recipient_id || d.recipient_name).map(d => d.recipient_id || d.recipient_name)
      );

      const newMembersThisMonth = monthlySnapshot.member_count;

      // Get 6-month trend data with REAL distribution data
      const monthlyTrend = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(now, 5 - i);
          return date;
        }).map(async (date) => {
          const start = startOfMonth(date).toISOString();
          const end = endOfMonth(date).toISOString();
          
          const collected = (await fundSnapshot(start, end)).collected;
          
          // Distributed (from real data)
          const { data: distributions } = await supabase
            .from('fund_distributions')
            .select('amount')
            .gte('distributed_at', start)
            .lte('distributed_at', end);

          const distributed = distributions?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

          return {
            month: format(date, 'MMM'),
            collected,
            distributed,
          };
        })
      );

      // Get recent distributions for display
      const { data: recentDistributions } = await supabase
        .from('fund_distributions')
        .select('id, category, amount, title, recipient_name, distributed_at')
        .order('distributed_at', { ascending: false })
        .limit(5);

      return {
        lifetime: {
          totalCollected: lifetimeTotalCollected,
          totalDistributed: lifetimeTotalDistributed,
          grantsAwarded,
          creatorsSupported: uniqueRecipients.size,
          memberCount: memberCount || 0,
        },
        monthly: {
          totalCollected: monthlyTotalCollected,
          totalDistributed: monthlyTotalDistributed,
          grantsAwarded: monthlyGrantsAwarded,
          creatorsSupported: monthlyUniqueRecipients.size,
          memberCount: newMembersThisMonth || 0,
        },
        monthlyTrend,
        allocations,
        recentDistributions: recentDistributions || [],
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
