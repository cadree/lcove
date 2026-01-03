import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformStats {
  totalCreatives: number;
  totalProjects: number;
  totalCities: number;
  totalEvents: number;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async (): Promise<PlatformStats> => {
      // Use RPC function to get stats without RLS restrictions
      // This is safe because it only returns aggregate counts
      const { data, error } = await supabase.rpc('get_platform_stats');

      if (error) {
        console.error('Failed to fetch platform stats:', error);
        throw error;
      }

      // The RPC returns an array with one row
      const stats = data?.[0];

      return {
        totalCreatives: Number(stats?.total_creators) || 0,
        totalProjects: Number(stats?.total_projects) || 0,
        totalCities: Number(stats?.total_cities) || 0,
        totalEvents: Number(stats?.total_events) || 0,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: true, // Refresh on tab focus
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });
}
