import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformStats {
  totalCreatives: number;
  totalProjects: number;
  totalCities: number;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async (): Promise<PlatformStats> => {
      // Fetch total profiles count
      const { count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch total projects count (open, in_progress, or completed)
      const { count: projectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress', 'completed']);

      // Fetch unique cities count
      const { data: citiesData } = await supabase
        .from('profiles')
        .select('city')
        .not('city', 'is', null);

      const uniqueCities = new Set(citiesData?.map(p => p.city?.toLowerCase().trim()).filter(Boolean));

      return {
        totalCreatives: profilesCount || 0,
        totalProjects: projectsCount || 0,
        totalCities: uniqueCities.size,
      };
    },
    staleTime: 60000, // Cache for 1 minute
  });
}
