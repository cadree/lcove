import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AttendeeIdentity {
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  city: string | null;
  phone: string | null;
  social_links: Record<string, string> | null;
  joined_at: string | null;
  email: string | null;
}

export interface AttendeeStats {
  tickets_purchased: number;
  events_attended: number;
  rsvp_count: number;
  no_show_count: number;
  lifetime_spend_cents: number;
  first_event: { id: string; title: string; date: string } | null;
  last_event: { id: string; title: string; date: string } | null;
}

export interface AttendeeOrder {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string | null;
  quantity: number;
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  refund_amount_cents: number | null;
  refunded_at: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
}

export interface AttendeeEventEntry {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string | null;
  event_venue: string | null;
  tier_id: string | null;
  tier_name: string | null;
  ticket_number: string;
  status: string;
  created_at: string;
}

export interface AttendeeTag {
  id: string;
  tag: string;
  created_at: string;
}

export interface AttendeeCrmProfile {
  identity: AttendeeIdentity;
  stats: AttendeeStats;
  orders: AttendeeOrder[];
  events: AttendeeEventEntry[];
  tags: AttendeeTag[];
  note: { id: string; note: string; updated_at: string } | null;
}

export interface AttendeeKey {
  email?: string | null;
  user_id?: string | null;
}

export function useAttendeeCrmProfile(key: AttendeeKey | null) {
  const enabled = !!(key && (key.email || key.user_id));
  return useQuery({
    queryKey: ["attendee-crm", key?.email?.toLowerCase() || null, key?.user_id || null],
    enabled,
    queryFn: async (): Promise<AttendeeCrmProfile> => {
      const { data, error } = await supabase.rpc("get_attendee_crm_profile" as any, {
        p_email: key?.email || "",
        p_user_id: key?.user_id || null,
      });
      if (error) throw error;
      return data as unknown as AttendeeCrmProfile;
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, key: AttendeeKey) {
  qc.invalidateQueries({ queryKey: ["attendee-crm", key.email?.toLowerCase() || null, key.user_id || null] });
}

export function useAddAttendeeTag(key: AttendeeKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) throw new Error("Tag cannot be empty");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("event_attendee_tags" as any).insert({
        host_user_id: user.id,
        attendee_email: key.email?.toLowerCase() || null,
        attendee_user_id: key.user_id || null,
        tag: trimmed,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, key),
    onError: (e: any) => toast.error(e?.message?.includes("duplicate") ? "Tag already exists" : (e?.message || "Failed to add tag")),
  });
}

export function useRemoveAttendeeTag(key: AttendeeKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from("event_attendee_tags" as any).delete().eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, key),
    onError: (e: any) => toast.error(e?.message || "Failed to remove tag"),
  });
}

export function useSaveAttendeeNote(key: AttendeeKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.rpc("upsert_attendee_note" as any, {
        p_email: key.email || "",
        p_user_id: key.user_id || null,
        p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, key),
    onError: (e: any) => toast.error(e?.message || "Failed to save note"),
  });
}

export function useResendReceipt() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.functions.invoke("send-rsvp-confirmation", {
        body: { order_id: orderId, type: "receipt" },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Receipt resent"),
    onError: (e: any) => toast.error(e?.message || "Failed to resend receipt"),
  });
}
