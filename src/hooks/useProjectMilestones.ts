import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ProjectMilestone {
  id: string;
  project_id: string;
  role_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'paid';
  due_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export function useProjectMilestones(projectId?: string) {
  return useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ProjectMilestone[];
    },
    enabled: !!projectId,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      project_id: string;
      role_id?: string;
      title: string;
      description?: string;
      amount: number;
      due_date?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('project_milestones')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', variables.project_id] });
      toast({ title: 'Milestone created' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create milestone',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMilestoneStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      milestoneId, 
      status,
      projectId 
    }: { 
      milestoneId: string; 
      status: ProjectMilestone['status'];
      projectId: string;
    }) => {
      const updates: Record<string, any> = { status };
      
      if (status === 'submitted') {
        updates.submitted_at = new Date().toISOString();
      } else if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
      } else if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('project_milestones')
        .update(updates)
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', variables.projectId] });
      toast({ title: 'Milestone updated' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update milestone',
        variant: 'destructive',
      });
    },
  });
}
