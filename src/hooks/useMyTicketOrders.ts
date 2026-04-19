import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MyAttendee {
  id: string;
  qr_code: string;
  ticket_number: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string;
}

export interface MyTicketOrder {
  id: string;
  event_id: string;
  quantity: number;
  total_cents: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    venue: string | null;
    city: string | null;
    image_url: string | null;
  } | null;
  attendees: MyAttendee[];
}

export function useMyTicketOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-ticket-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as MyTicketOrder[];
      const { data, error } = await supabase
        .from("ticket_orders")
        .select(`
          id, event_id, quantity, total_cents, currency, payment_method, payment_status, created_at,
          event:events(id, title, start_date, end_date, venue, city, image_url),
          attendees:event_attendees(id, qr_code, ticket_number, attendee_name, attendee_email, status)
        `)
        .eq("purchaser_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((o: any) => o.event) as unknown as MyTicketOrder[];
    },
  });
}
