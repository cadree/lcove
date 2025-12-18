import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReputationScore {
  id: string;
  user_id: string;
  overall_score: number;
  review_score: number;
  review_count: number;
  completed_projects: number;
  on_time_delivery_rate: number;
  response_rate: number;
  last_calculated_at: string;
}

export function useReputation(userId?: string) {
  return useQuery({
    queryKey: ['reputation', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('reputation_scores')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as ReputationScore | null;
    },
    enabled: !!userId,
  });
}

export function useReputationLevel(score: number | undefined) {
  if (!score || score === 0) return { level: 'New', color: 'muted' };
  if (score < 2) return { level: 'Rising', color: 'secondary' };
  if (score < 3.5) return { level: 'Established', color: 'accent' };
  if (score < 4.5) return { level: 'Expert', color: 'primary' };
  return { level: 'Elite', color: 'gold' };
}
