import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TicketOrder {
  id: string;
  event_id: string;
  purchaser_user_id: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  quantity: number;
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  credits_spent: number;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  source: string | null;
  refund_amount_cents: number;
  refunded_at: string | null;
  created_at: string;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  order_id: string | null;
  tier_id: string | null;
  attendee_user_id: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  ticket_number: string;
  qr_code: string;
  status: string;
  created_at: string;
}

/** Fetch new-schema orders + attendees for an event. */
export function useEventTicketingData(eventId?: string) {
  const ordersQ = useQuery({
    queryKey: ["event-orders-v2", eventId],
    queryFn: async (): Promise<TicketOrder[]> => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("ticket_orders")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as TicketOrder[]) || [];
    },
    enabled: !!eventId,
  });

  const attendeesQ = useQuery({
    queryKey: ["event-attendees-v2", eventId],
    queryFn: async (): Promise<EventAttendee[]> => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_attendees")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as EventAttendee[]) || [];
    },
    enabled: !!eventId,
  });

  const tiersQ = useQuery({
    queryKey: ["event-tiers", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("ticket_tiers")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  return {
    orders: ordersQ.data || [],
    attendees: attendeesQ.data || [],
    tiers: tiersQ.data || [],
    isLoading: ordersQ.isLoading || attendeesQ.isLoading || tiersQ.isLoading,
  };
}
