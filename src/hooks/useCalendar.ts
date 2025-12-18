import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  venue: string | null;
  address: string | null;
  city: string;
  state: string | null;
  country: string | null;
  start_date: string;
  end_date: string | null;
  image_url: string | null;
  ticket_type: string;
  ticket_price: number | null;
  credits_price: number | null;
  capacity: number | null;
  is_public: boolean | null;
  project_id: string | null;
  external_url: string | null;
  created_at: string;
  rsvp_count?: number;
  user_rsvp?: EventRSVP | null;
  organizer?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  ticket_purchased: boolean | null;
  reminder_enabled: boolean | null;
  created_at: string;
}

export interface PersonalCalendarItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean | null;
  color: string | null;
  reminder_minutes: number | null;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
  status: string;
  creator_id: string;
}

export interface CalendarItem {
  id: string;
  type: 'event' | 'project' | 'personal';
  title: string;
  start_date: string;
  end_date: string | null;
  city?: string;
  state?: string;
  color?: string;
  data: CalendarEvent | PersonalCalendarItem | Project;
}

export function useEvents(filters?: { city?: string; state?: string }) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });
      
      if (filters?.city && filters.city !== 'All Cities') {
        query = query.eq('city', filters.city);
      }
      if (filters?.state && filters.state !== 'All States') {
        query = query.eq('state', filters.state);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useEventWithRSVP(eventId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['event', eventId, user?.id],
    queryFn: async () => {
      const { data: event, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (error) throw error;

      // Get RSVP count
      const { count } = await supabase
        .from('event_rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'going');

      // Get user's RSVP if logged in
      let userRsvp = null;
      if (user) {
        const { data: rsvp } = await supabase
          .from('event_rsvps')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        userRsvp = rsvp;
      }

      // Get organizer profile
      let organizer = null;
      if (event.creator_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', event.creator_id)
          .maybeSingle();
        organizer = profile;
      }

      return {
        ...event,
        rsvp_count: count || 0,
        user_rsvp: userRsvp,
        organizer,
      } as CalendarEvent;
    },
    enabled: !!eventId,
  });
}

export function usePersonalCalendarItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['personal-calendar-items', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('personal_calendar_items')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });
      
      if (error) throw error;
      return data as PersonalCalendarItem[];
    },
    enabled: !!user,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['calendar-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, timeline_start, timeline_end, status, creator_id')
        .not('timeline_start', 'is', null)
        .in('status', ['open', 'in_progress'])
        .order('timeline_start', { ascending: true });
      
      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useCalendarItems(filters?: { city?: string; state?: string; types?: string[] }) {
  const { user } = useAuth();
  const { data: events } = useEvents(filters);
  const { data: personalItems } = usePersonalCalendarItems();
  const { data: projects } = useProjects();

  const showEvents = !filters?.types || filters.types.includes('events');
  const showProjects = !filters?.types || filters.types.includes('projects');
  const showPersonal = !filters?.types || filters.types.includes('personal');

  const items: CalendarItem[] = [];

  if (showEvents && events) {
    events.forEach(event => {
      items.push({
        id: event.id,
        type: 'event',
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        city: event.city,
        state: event.state || undefined,
        color: '#FF69B4', // bubblegum pink for events
        data: event,
      });
    });
  }

  if (showProjects && projects) {
    projects.forEach(project => {
      if (project.timeline_start) {
        items.push({
          id: project.id,
          type: 'project',
          title: project.title,
          start_date: project.timeline_start,
          end_date: project.timeline_end,
          color: '#8B4513', // brown for projects
          data: project,
        });
      }
    });
  }

  if (showPersonal && personalItems) {
    personalItems.forEach(item => {
      items.push({
        id: item.id,
        type: 'personal',
        title: item.title,
        start_date: item.start_date,
        end_date: item.end_date,
        color: item.color || '#D2B48C', // tan for personal
        data: item,
      });
    });
  }

  return items.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
}

export function useRSVP() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const rsvpMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: string }) => {
      if (!user) throw new Error('Must be logged in to RSVP');

      const { data: existing } = await supabase
        .from('event_rsvps')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('event_rsvps')
          .update({ status })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_rsvps')
          .insert({ event_id: eventId, user_id: user.id, status });
        if (error) throw error;
      }
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('RSVP updated!');
    },
    onError: (error) => {
      toast.error('Failed to update RSVP');
      console.error(error);
    },
  });

  const toggleReminderMutation = useMutation({
    mutationFn: async ({ eventId, enabled }: { eventId: string; enabled: boolean }) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('event_rsvps')
        .update({ reminder_enabled: enabled })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Reminder preference updated');
    },
  });

  return {
    rsvp: rsvpMutation.mutate,
    isRsvping: rsvpMutation.isPending,
    toggleReminder: toggleReminderMutation.mutate,
  };
}

export function useCreatePersonalItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: Omit<PersonalCalendarItem, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('personal_calendar_items')
        .insert({ ...item, user_id: user.id });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-calendar-items'] });
      toast.success('Personal event added to calendar');
    },
    onError: (error) => {
      toast.error('Failed to add event');
      console.error(error);
    },
  });
}

export function useDeletePersonalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('personal_calendar_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-calendar-items'] });
      toast.success('Event removed from calendar');
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (event: Omit<CalendarEvent, 'id' | 'creator_id' | 'created_at' | 'rsvp_count' | 'user_rsvp'>) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('events')
        .insert({ ...event, creator_id: user.id });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created!');
    },
    onError: (error) => {
      toast.error('Failed to create event');
      console.error(error);
    },
  });
}
