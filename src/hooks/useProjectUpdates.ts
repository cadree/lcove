import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ProjectUpdate {
  id: string;
  project_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { display_name: string | null; avatar_url: string | null };
}

export function useProjectUpdates(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: updates = [], isLoading } = useQuery({
    queryKey: ['project-updates', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase
        .from('project_updates') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author profiles
      const authorIds = [...new Set((data as any[]).map((u: any) => u.author_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', authorIds);

      return (data as any[]).map((update: any) => ({
        ...update,
        author: profiles?.find(p => p.user_id === update.author_id),
      })) as ProjectUpdate[];
    },
    enabled: !!projectId,
  });

  const addUpdate = useMutation({
    mutationFn: async ({ projectId, content }: { projectId: string; content: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await (supabase
        .from('project_updates') as any)
        .insert({
          project_id: projectId,
          author_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-updates', variables.projectId] });
      toast({ title: 'Update posted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to post update', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    },
  });

  return {
    updates,
    isLoading,
    addUpdate: addUpdate.mutate,
    isPosting: addUpdate.isPending,
  };
}
