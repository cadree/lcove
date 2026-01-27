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
  archived_at: string | null;
  completed_at: string | null;
}

export function useContactTasks(pipelineItemId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { earnEnergy } = useEnergy();

  // Active tasks (not archived)
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['contact-tasks', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      
      const { data, error } = await supabase
        .from('contact_tasks')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .is('archived_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ContactTask[];
    },
    enabled: !!user && !!pipelineItemId,
  });

  // Archived tasks
  const { data: archivedTasks = [], isLoading: isLoadingArchived } = useQuery({
    queryKey: ['contact-tasks-archived', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      
      const { data, error } = await supabase
        .from('contact_tasks')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });
      
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
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, title, dueAt }: { taskId: string; title?: string; dueAt?: string | null }) => {
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (dueAt !== undefined) updates.due_at = dueAt;
      
      const { data, error } = await supabase
        .from('contact_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
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
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
      
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

  const archiveTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('contact_tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks-archived', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
    },
  });

  const archiveCompletedTasks = useMutation({
    mutationFn: async () => {
      if (!pipelineItemId) throw new Error("Missing pipeline item");
      
      const { error } = await supabase
        .from('contact_tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('pipeline_item_id', pipelineItemId)
        .eq('is_done', true)
        .is('archived_at', null);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks-archived', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
    },
  });

  const restoreTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('contact_tasks')
        .update({ archived_at: null })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks-archived', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
    },
  });

  const clearCompletedTasks = useMutation({
    mutationFn: async () => {
      if (!pipelineItemId) throw new Error("Missing pipeline item");
      
      const { error } = await supabase
        .from('contact_tasks')
        .delete()
        .eq('pipeline_item_id', pipelineItemId)
        .eq('is_done', true)
        .is('archived_at', null);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
    },
  });

  const clearArchivedTasks = useMutation({
    mutationFn: async () => {
      if (!pipelineItemId) throw new Error("Missing pipeline item");
      
      const { error } = await supabase
        .from('contact_tasks')
        .delete()
        .eq('pipeline_item_id', pipelineItemId)
        .not('archived_at', 'is', null);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks-archived', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
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
      queryClient.invalidateQueries({ queryKey: ['contact-tasks-archived', pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
    },
  });

  // Separate completed from incomplete tasks
  const incompleteTasks = tasks.filter(t => !t.is_done);
  const completedTasks = tasks.filter(t => t.is_done);

  return {
    tasks,
    incompleteTasks,
    completedTasks,
    archivedTasks,
    isLoading,
    isLoadingArchived,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    toggleTask: toggleTask.mutateAsync,
    archiveTask: archiveTask.mutateAsync,
    archiveCompletedTasks: archiveCompletedTasks.mutateAsync,
    restoreTask: restoreTask.mutateAsync,
    clearCompletedTasks: clearCompletedTasks.mutateAsync,
    clearArchivedTasks: clearArchivedTasks.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    isCreating: createTask.isPending,
    isArchiving: archiveCompletedTasks.isPending,
  };
}

// Hook for My Day dashboard - gets ALL incomplete tasks (not archived)
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
        .is('archived_at', null)
        .order('due_at', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      
      return data as (ContactTask & { 
        pipeline_items: { id: string; name: string; company: string | null; stage_id: string } 
      })[];
    },
    enabled: !!user,
  });
}
