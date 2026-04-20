import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCampaignAnalytics(eventId?: string) {
  return useQuery({
    queryKey: ["campaign-analytics", eventId || "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_analytics", { p_event_id: eventId || null });
      if (error) throw error;
      return data as any;
    },
    enabled: true,
  });
}

export function useAudienceEstimate(filter: any, enabled = true) {
  return useQuery({
    queryKey: ["audience-estimate", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audience_estimate", { filter });
      if (error) throw error;
      return data as number;
    },
    enabled,
  });
}

export interface AudiencePreviewUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  interests: string[] | null;
  last_active_at: string | null;
  city: string | null;
}

export function useAudiencePreview(filter: any, enabled = true, limit = 12) {
  return useQuery({
    queryKey: ["audience-preview", filter, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audience_preview", { filter, p_limit: limit });
      if (error) throw error;
      return (data || []) as AudiencePreviewUser[];
    },
    enabled,
  });
}

export function useAutoReminders(eventId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["auto-reminders", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_auto_reminders")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const upsert = useMutation({
    mutationFn: async (patch: { enabled_24h?: boolean; enabled_2h?: boolean; enabled_at_door?: boolean }) => {
      const { error } = await supabase
        .from("event_auto_reminders")
        .upsert({ event_id: eventId, ...patch }, { onConflict: "event_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-reminders", eventId] }),
  });

  return { ...query, upsert };
}

export async function sendIndividualReminder(payload: any) {
  const { data, error } = await supabase.functions.invoke("send-individual-reminder", { body: payload });
  if (error) throw error;
  return data;
}

export async function sendBulkReminder(payload: any) {
  const { data, error } = await supabase.functions.invoke("send-bulk-attendee-reminder", { body: payload });
  if (error) throw error;
  return data;
}

export async function sendAudienceInvite(payload: any) {
  const { data, error } = await supabase.functions.invoke("send-audience-invite", { body: payload });
  if (error) throw error;
  return data;
}
