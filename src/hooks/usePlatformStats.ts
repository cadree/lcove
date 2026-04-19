import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformStats {
  totalCreatives: number;
  totalProjects: number;
  totalCities: number;
  totalEvents: number;
}

export function usePlatformStats() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('platform-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async (): Promise<PlatformStats> => {
      const { data, error } = await supabase.rpc('get_platform_stats');

      if (error) {
        console.error('Failed to fetch platform stats:', error);
        throw error;
      }

      const stats = data?.[0];

      return {
        totalCreatives: Number(stats?.total_creators) || 0,
        totalProjects: Number(stats?.total_projects) || 0,
        totalCities: Number(stats?.total_cities) || 0,
        totalEvents: Number(stats?.total_events) || 0,
      };
    },
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000,
  });
}
