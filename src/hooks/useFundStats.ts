import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

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
}

export function useFundStats() {
  const queryClient = useQueryClient();

  // Set up real-time subscription
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
          // Invalidate and refetch when contributions change
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

      // Lifetime stats from membership_contributions
      const { data: lifetimeContributions } = await supabase
        .from('membership_contributions')
        .select('amount, allocated_to, user_id');

      const lifetimeTotalCollected = lifetimeContributions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      
      // Calculate distributed based on allocation percentages (excluding operations)
      const lifetimeTotalDistributed = lifetimeTotalCollected * 0.9; // 90% goes to community (excl. 10% operations)
      
      // Calculate actual dollar allocations
      const allocations = {
        communityGrants: lifetimeTotalDistributed * 0.4,
        eventsActivations: lifetimeTotalDistributed * 0.2,
        education: lifetimeTotalDistributed * 0.15,
        infrastructure: lifetimeTotalDistributed * 0.15,
        operations: lifetimeTotalCollected * 0.1,
      };
      
      // Unique contributors as "creators supported"
      const uniqueContributors = new Set(lifetimeContributions?.map(c => c.user_id));
      
      // Get active memberships count
      const { count: memberCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Monthly stats
      const { data: monthlyContributions } = await supabase
        .from('membership_contributions')
        .select('amount, user_id')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const monthlyTotalCollected = monthlyContributions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const monthlyTotalDistributed = monthlyTotalCollected * 0.9;
      const monthlyUniqueContributors = new Set(monthlyContributions?.map(c => c.user_id));

      // New members this month
      const { count: newMembersThisMonth } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      // Calculate grants awarded (40% of distributed goes to grants, estimate ~$500 per grant average)
      const lifetimeGrantsAwarded = Math.floor((lifetimeTotalDistributed * 0.4) / 500);
      const monthlyGrantsAwarded = Math.floor((monthlyTotalDistributed * 0.4) / 500);

      // Get 6-month trend data
      const monthlyTrend = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(now, 5 - i);
          return date;
        }).map(async (date) => {
          const start = startOfMonth(date).toISOString();
          const end = endOfMonth(date).toISOString();
          
          const { data } = await supabase
            .from('membership_contributions')
            .select('amount')
            .gte('created_at', start)
            .lte('created_at', end);

          const collected = data?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
          
          return {
            month: format(date, 'MMM'),
            collected,
            distributed: collected * 0.9,
          };
        })
      );

      return {
        lifetime: {
          totalCollected: lifetimeTotalCollected,
          totalDistributed: lifetimeTotalDistributed,
          grantsAwarded: lifetimeGrantsAwarded || 0,
          creatorsSupported: uniqueContributors.size,
          memberCount: memberCount || 0,
        },
        monthly: {
          totalCollected: monthlyTotalCollected,
          totalDistributed: monthlyTotalDistributed,
          grantsAwarded: monthlyGrantsAwarded || 0,
          creatorsSupported: monthlyUniqueContributors.size,
          memberCount: newMembersThisMonth || 0,
        },
        monthlyTrend,
        allocations,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Auto-refetch every minute
  });
}
