import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, startOfMonth, startOfDay, subDays, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";

export interface TaskEvent {
  id: string;
  owner_user_id: string;
  task_id: string | null;
  pipeline_item_id: string | null;
  event_type: 'created' | 'completed' | 'archived' | 'deleted' | 'updated';
  task_title: string;
  contact_name: string | null;
  created_at: string;
}

export interface TaskStats {
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  createdThisWeek: number;
  mostActiveContact: { name: string; count: number } | null;
}

export function useTaskEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['task-events'],
    queryFn: async () => {
      // Get events from the last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data, error } = await supabase
        .from('task_events')
        .select('*')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data as TaskEvent[];
    },
    enabled: !!user,
  });

  // Calculate stats from events
  const stats: TaskStats = {
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
    createdThisWeek: 0,
    mostActiveContact: null,
  };

  const contactCounts: Record<string, number> = {};

  events.forEach(event => {
    const date = new Date(event.created_at);
    
    if (event.event_type === 'completed') {
      if (isToday(date)) stats.completedToday++;
      if (isThisWeek(date)) stats.completedThisWeek++;
      if (isThisMonth(date)) stats.completedThisMonth++;
      
      if (event.contact_name) {
        contactCounts[event.contact_name] = (contactCounts[event.contact_name] || 0) + 1;
      }
    }
    
    if (event.event_type === 'created' && isThisWeek(date)) {
      stats.createdThisWeek++;
    }
  });

  // Find most active contact
  const sortedContacts = Object.entries(contactCounts).sort((a, b) => b[1] - a[1]);
  if (sortedContacts.length > 0) {
    stats.mostActiveContact = { name: sortedContacts[0][0], count: sortedContacts[0][1] };
  }

  // Group events by time period
  const groupedEvents = {
    today: events.filter(e => isToday(new Date(e.created_at))),
    yesterday: events.filter(e => isYesterday(new Date(e.created_at))),
    thisWeek: events.filter(e => {
      const date = new Date(e.created_at);
      return isThisWeek(date) && !isToday(date) && !isYesterday(date);
    }),
    older: events.filter(e => {
      const date = new Date(e.created_at);
      return !isThisWeek(date);
    }),
  };

  const clearOldEvents = useMutation({
    mutationFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { error } = await supabase
        .from('task_events')
        .delete()
        .lt('created_at', thirtyDaysAgo);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-events'] });
    },
  });

  return {
    events,
    groupedEvents,
    stats,
    isLoading,
    clearOldEvents: clearOldEvents.mutateAsync,
  };
}
