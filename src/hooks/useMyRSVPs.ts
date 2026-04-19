import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MyRSVP {
  id: string;
  event_id: string;
  status: string;
  ticket_purchased: boolean | null;
  reminder_enabled: boolean | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    venue: string | null;
    city: string | null;
    state: string | null;
    image_url: string | null;
    ticket_type: string;
    ticket_price: number | null;
  } | null;
}

export function useMyRSVPs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-rsvps', user?.id],
    queryFn: async () => {
      if (!user) return [] as MyRSVP[];
      const { data, error } = await supabase
        .from('event_rsvps')
        .select(`
          id, event_id, status, ticket_purchased, reminder_enabled, created_at,
          event:events(id, title, description, start_date, end_date, venue, city, state, image_url, ticket_type, ticket_price)
        `)
        .eq('user_id', user.id)
        .in('status', ['going', 'interested'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((r: any) => r.event) as unknown as MyRSVP[];
    },
    enabled: !!user,
  });
}

export function useCancelRSVP() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rsvpId: string) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('event_rsvps').delete().eq('id', rsvpId).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-rsvps'] });
      toast.success('RSVP cancelled');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to cancel'),
  });
}
