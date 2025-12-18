import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AIProjectMatch {
  project: {
    id: string;
    title: string;
    description: string | null;
    total_budget: number;
    currency: string;
    project_roles: {
      id: string;
      role_name: string;
      payout_amount: number;
      slots_available: number;
      slots_filled: number;
    }[];
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  role: {
    id: string;
    role_name: string;
    payout_amount: number;
  } | null;
  match_score: number;
  reasons: string[];
}

export function useAIProjectMatches() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useQuery({
    queryKey: ['ai-project-matches', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.functions.invoke('ai-project-match');

      if (error) {
        console.error('Error fetching AI matches:', error);
        throw error;
      }

      return (data?.matches || []) as AIProjectMatch[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  });
}

export function useRefreshAIMatches() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-project-match');
      if (error) throw error;
      return data?.matches || [];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-project-matches', user?.id], data);
      toast({
        title: 'Matches updated',
        description: `Found ${data.length} project recommendations for you.`,
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to refresh matches';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    },
  });
}

export function useDismissMatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('ai_project_matches')
        .update({ is_dismissed: true })
        .eq('user_id', user?.id)
        .eq('project_id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-project-matches'] });
    },
  });
}
