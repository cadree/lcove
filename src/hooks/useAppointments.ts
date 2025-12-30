import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface Appointment {
  id: string;
  owner_user_id: string;
  team_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: 'confirmed' | 'canceled' | 'completed';
  created_at: string;
  updated_at: string;
  contact?: {
    full_name: string;
    email: string | null;
  } | null;
  team?: {
    name: string;
  } | null;
}

export interface Team {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Contact {
  id: string;
  owner_user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
}

export interface BookingPage {
  id: string;
  owner_user_id: string;
  slug: string;
  title: string;
  is_active: boolean;
  timezone: string;
  meeting_length_minutes: number;
  availability: AvailabilityConfig;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityConfig {
  weekly: {
    mon: TimeBlock[];
    tue: TimeBlock[];
    wed: TimeBlock[];
    thu: TimeBlock[];
    fri: TimeBlock[];
    sat: TimeBlock[];
    sun: TimeBlock[];
  };
  buffers: {
    before_min: number;
    after_min: number;
  };
  advance_days: number;
}

export interface TimeBlock {
  start: string;
  end: string;
}

export interface BookingRequest {
  id: string;
  booking_page_id: string;
  appointment_id: string | null;
  contact_name: string;
  contact_email: string;
  requested_start: string;
  requested_end: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

// Fetch user's appointments
export function useAppointments(options?: { 
  teamId?: string | null;
  startDate?: Date;
  endDate?: Date;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['appointments', user?.id, options?.teamId, options?.startDate?.toISOString(), options?.endDate?.toISOString()],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('appointments')
        .select(`
          *,
          contact:contacts(full_name, email),
          team:teams(name)
        `)
        .order('starts_at', { ascending: true });

      if (options?.teamId) {
        query = query.eq('team_id', options.teamId);
      }

      if (options?.startDate) {
        query = query.gte('starts_at', options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte('starts_at', options.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!user,
  });
}

// Fetch appointments by owner ID (for public booking page)
export function useAppointmentsByOwner(ownerId: string) {
  return useQuery({
    queryKey: ['appointments-by-owner', ownerId],
    queryFn: async () => {
      if (!ownerId) return [];

      const { data, error } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status')
        .eq('owner_user_id', ownerId)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!ownerId,
  });
}

// Create appointment
export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (appointment: {
      title: string;
      description?: string | null;
      starts_at: string;
      ends_at: string;
      location?: string | null;
      team_id?: string | null;
      contact_id?: string | null;
      status?: 'confirmed' | 'canceled' | 'completed';
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          ...appointment,
          owner_user_id: user.id,
          status: appointment.status || 'confirmed',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment created');
    },
    onError: (error) => {
      toast.error('Failed to create appointment');
      console.error(error);
    },
  });
}

// Update appointment
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: Partial<Appointment> & { id: string }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment updated');
    },
    onError: (error) => {
      toast.error('Failed to update appointment');
      console.error(error);
    },
  });
}

// Delete appointment
export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete appointment');
      console.error(error);
    },
  });
}

// Fetch user's teams
export function useTeams() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teams', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Team[];
    },
    enabled: !!user,
  });
}

// Fetch user's contacts
export function useContacts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user,
  });
}

// Create contact
export function useCreateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contact: {
      full_name: string;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contact,
          owner_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created');
    },
    onError: (error) => {
      toast.error('Failed to create contact');
      console.error(error);
    },
  });
}

// Fetch booking pages
export function useBookingPages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['booking-pages', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('booking_pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as BookingPage[];
    },
    enabled: !!user,
  });
}

// Fetch single booking page by slug (public)
export function useBookingPageBySlug(slug: string) {
  return useQuery({
    queryKey: ['booking-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_pages')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as unknown as BookingPage;
    },
    enabled: !!slug,
  });
}

// Create booking page
export function useCreateBookingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (page: {
      slug: string;
      title?: string;
      timezone?: string;
      meeting_length_minutes?: number;
      availability?: AvailabilityConfig;
      is_active?: boolean;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const insertData = {
        slug: page.slug,
        title: page.title,
        timezone: page.timezone,
        meeting_length_minutes: page.meeting_length_minutes,
        availability: page.availability as unknown as Json,
        is_active: page.is_active,
        owner_user_id: user.id,
      };
      
      const { data, error } = await supabase
        .from('booking_pages')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      toast.success('Booking page created');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This URL slug is already taken');
      } else {
        toast.error('Failed to create booking page');
      }
      console.error(error);
    },
  });
}

// Update booking page
export function useUpdateBookingPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      availability,
      ...updates 
    }: Partial<BookingPage> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (availability) {
        updateData.availability = availability as unknown as Record<string, unknown>;
      }
      
      const { data, error } = await supabase
        .from('booking_pages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      toast.success('Booking page updated');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This URL slug is already taken');
      } else {
        toast.error('Failed to update booking page');
      }
      console.error(error);
    },
  });
}

// Delete booking page
export function useDeleteBookingPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      toast.success('Booking page deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete booking page');
      console.error(error);
    },
  });
}

// Fetch booking requests for a booking page
export function useBookingRequests(bookingPageId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['booking-requests', bookingPageId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('booking_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingPageId) {
        query = query.eq('booking_page_id', bookingPageId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BookingRequest[];
    },
    enabled: !!user,
  });
}

// Fetch owner's existing appointments for conflict checking (public use)
export function useOwnerAppointments(ownerId: string, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['owner-appointments', ownerId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('starts_at, ends_at')
        .eq('owner_user_id', ownerId)
        .eq('status', 'confirmed')
        .gte('starts_at', startDate.toISOString())
        .lte('starts_at', endDate.toISOString());

      if (error) throw error;
      return data as { starts_at: string; ends_at: string }[];
    },
    enabled: !!ownerId,
  });
}
