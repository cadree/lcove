import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnergy, ENERGY_GAINS } from "@/hooks/useEnergy";

export interface ContactTask {
  id: string;
  owner_user_id: string;
  pipeline_item_id: string;
  title: string;
  due_at: string | null;
  is_done: boolean;
  created_at: string;
}

export function useContactTasks(pipelineItemId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { earnEnergy } = useEnergy();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['contact-tasks', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      
      const { data, error } = await supabase
        .from('contact_tasks')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ContactTask[];
    },
    enabled: !!user && !!pipelineItemId,
  });

  const createTask = useMutation({
    mutationFn: async ({ title, dueAt }: { title: string; dueAt?: string }) => {
      if (!pipelineItemId || !user) throw new Error("Missing required data");
      
      const { data, error } = await supabase
        .from('contact_tasks')
        .insert({
          owner_user_id: user.id,
          pipeline_item_id: pipelineItemId,
          title,
          due_at: dueAt || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, isDone }: { taskId: string; isDone: boolean }) => {
      const { data, error } = await supabase
        .from('contact_tasks')
        .update({ is_done: isDone })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, isDone };
    },
    onSuccess: async ({ data, isDone }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      
      // Award energy points when completing a task
      if (isDone) {
        try {
          await earnEnergy({
            amount: ENERGY_GAINS.task_complete,
            source: 'task_complete',
            sourceId: data.id,
            description: `Completed task: ${data.title}`,
          });
        } catch (err) {
          console.error('Failed to award energy for task:', err);
        }
      }
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('contact_tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
    },
  });

  return {
    tasks,
    isLoading,
    createTask: createTask.mutateAsync,
    toggleTask: toggleTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    isCreating: createTask.isPending,
  };
}

// Hook for My Day dashboard - gets ALL incomplete tasks
export function useMyDayTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-day-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_tasks')
        .select(`
          *,
          pipeline_items!inner (
            id,
            name,
            company,
            stage_id
          )
        `)
        .eq('is_done', false)
        .order('due_at', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      
      return data as (ContactTask & { 
        pipeline_items: { id: string; name: string; company: string | null; stage_id: string } 
      })[];
    },
    enabled: !!user,
  });
}
