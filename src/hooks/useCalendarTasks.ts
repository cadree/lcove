import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CalendarTask {
  id: string;
  user_id: string;
  title: string;
  event_id: string | null;
  project_id: string | null;
  personal_item_id: string | null;
  due_at: string | null;
  is_done: boolean;
  created_at: string;
}

export interface CalendarTaskWithDetails extends CalendarTask {
  events?: { id: string; title: string; start_date: string } | null;
  projects?: { id: string; title: string; timeline_start: string | null } | null;
  personal_calendar_items?: { id: string; title: string; start_date: string } | null;
}

export function useCalendarTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all calendar tasks for the user
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_tasks')
        .select(`
          *,
          events(id, title, start_date),
          projects(id, title, timeline_start),
          personal_calendar_items(id, title, start_date)
        `)
        .order('due_at', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as CalendarTaskWithDetails[];
    },
    enabled: !!user,
  });

  // Check if an item is already added to My Day
  const isAddedToMyDay = (eventId?: string, projectId?: string, personalItemId?: string) => {
    return tasks.some(t => 
      (eventId && t.event_id === eventId) ||
      (projectId && t.project_id === projectId) ||
      (personalItemId && t.personal_item_id === personalItemId)
    );
  };

  // Add event to My Day
  const addEventToMyDay = useMutation({
    mutationFn: async ({ eventId, title, dueAt }: { eventId: string; title: string; dueAt?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from('calendar_tasks')
        .insert({
          user_id: user.id,
          event_id: eventId,
          title,
          due_at: dueAt || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Add project to My Day
  const addProjectToMyDay = useMutation({
    mutationFn: async ({ projectId, title, dueAt }: { projectId: string; title: string; dueAt?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from('calendar_tasks')
        .insert({
          user_id: user.id,
          project_id: projectId,
          title,
          due_at: dueAt || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Add personal item to My Day
  const addPersonalItemToMyDay = useMutation({
    mutationFn: async ({ personalItemId, title, dueAt }: { personalItemId: string; title: string; dueAt?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from('calendar_tasks')
        .insert({
          user_id: user.id,
          personal_item_id: personalItemId,
          title,
          due_at: dueAt || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Toggle task completion
  const toggleTask = useMutation({
    mutationFn: async ({ taskId, isDone }: { taskId: string; isDone: boolean }) => {
      const { data, error } = await supabase
        .from('calendar_tasks')
        .update({ is_done: isDone })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Remove task
  const removeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('calendar_tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Remove task by event/project/personal item ID
  const removeByReference = useMutation({
    mutationFn: async ({ eventId, projectId, personalItemId }: { eventId?: string; projectId?: string; personalItemId?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      let query = supabase.from('calendar_tasks').delete().eq('user_id', user.id);
      
      if (eventId) {
        query = query.eq('event_id', eventId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      } else if (personalItemId) {
        query = query.eq('personal_item_id', personalItemId);
      }
      
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  return {
    tasks,
    isLoading,
    isAddedToMyDay,
    addEventToMyDay,
    addProjectToMyDay,
    addPersonalItemToMyDay,
    toggleTask,
    removeTask,
    removeByReference,
  };
}

// Hook for My Day dashboard - gets ALL incomplete calendar tasks
export function useMyDayCalendarTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-day-calendar-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_tasks')
        .select(`
          *,
          events(id, title, start_date),
          projects(id, title, timeline_start),
          personal_calendar_items(id, title, start_date)
        `)
        .eq('is_done', false)
        .order('due_at', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as CalendarTaskWithDetails[];
    },
    enabled: !!user,
  });
}
