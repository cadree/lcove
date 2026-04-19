import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CheckInResult {
  success: boolean;
  error?: string;
  check_in_id?: string;
  checked_in_at?: string;
  attendee?: {
    id: string;
    name: string | null;
    email: string | null;
    ticket_number: string;
    tier_name: string | null;
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "You must be signed in to check people in.",
  invalid_qr: "Invalid ticket — QR code not recognized.",
  wrong_event: "This ticket is for a different event.",
  not_authorized: "You don't have permission to check in for this event.",
  attendee_not_active: "This ticket has been cancelled or refunded.",
  already_checked_in: "Already checked in.",
};

export function useCheckInAttendee(eventId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { qrCode: string; method?: string; notes?: string }): Promise<CheckInResult> => {
      const { data, error } = await supabase.rpc("check_in_attendee", {
        p_qr_code: params.qrCode.trim(),
        p_event_id: eventId || null,
        p_method: params.method || "qr",
        p_notes: params.notes || null,
      });
      if (error) throw error;
      return data as unknown as CheckInResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`✓ ${result.attendee?.name || result.attendee?.ticket_number} checked in`);
      } else if (result.error === "already_checked_in") {
        toast.warning(`Already checked in: ${result.attendee?.name || result.attendee?.ticket_number}`);
      } else {
        toast.error(ERROR_MESSAGES[result.error || ""] || "Check-in failed");
      }
      queryClient.invalidateQueries({ queryKey: ["event-attendees-v2", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-check-ins", eventId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Check-in failed");
    },
  });
}

export function useEventCheckIns(eventId?: string) {
  return useQuery({
    queryKey: ["event-check-ins", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_check_ins")
        .select("*, event_attendees(id, attendee_name, attendee_email, ticket_number, tier_id)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });
}
