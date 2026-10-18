import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface CampaignTotals {
  sent?: number;
  opened?: number;
  clicked?: number;
  failed?: number;
}

export interface CampaignSummary {
  id: string;
  title?: string | null;
  type?: string;
  created_at?: string;
  sent_count?: number;
  recipient_count?: number;
}

export interface CampaignAnalytics {
  totals?: CampaignTotals;
  recent_campaigns?: CampaignSummary[];
}

export interface AudienceFilter {
  states?: string[];
  interests?: string[];
  lookalike?: boolean;
  active_only?: boolean;
  age_min?: number | null;
  age_max?: number | null;
}

export interface IndividualReminderPayload {
  eventId: string;
  attendeeEmail?: string | null;
  attendeeUserId?: string | null;
  attendeeName?: string | null;
  attendeePhone?: string | null;
  tierName?: string | null;
  channels: { push: boolean; email: boolean; sms: boolean };
  title: string;
  body: string;
}

export interface BulkReminderPayload {
  eventId: string;
  title: string;
  body: string;
  channels: { push: boolean; email: boolean; sms: boolean };
  filter: { tierIds?: string[]; status: string[] };
}

export interface AudienceInvitePayload {
  eventId?: string;
  title: string;
  body: string;
  channels: { push: boolean; email: boolean };
  filter?: AudienceFilter;
  lookalike?: boolean;
  userIds?: string[];
}

function asJson(value: object): Json {
  return value as unknown as Json;
}

function invokeBody(payload: object): { [key: string]: Json | undefined } {
  return { ...payload } as unknown as { [key: string]: Json | undefined };
}

export function useCampaignAnalytics(eventId?: string) {
  return useQuery({
    queryKey: ["campaign-analytics", eventId || "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_analytics", { p_event_id: eventId || null });
      if (error) throw error;
      return data as unknown as CampaignAnalytics;
    },
    enabled: true,
  });
}

export function useAudienceEstimate(filter: AudienceFilter, enabled = true) {
  return useQuery({
    queryKey: ["audience-estimate", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audience_estimate", { filter: asJson(filter) });
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

export function useAudiencePreview(filter: AudienceFilter, enabled = true, limit = 12) {
  return useQuery({
    queryKey: ["audience-preview", filter, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audience_preview", { filter: asJson(filter), p_limit: limit });
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

export async function sendIndividualReminder(payload: IndividualReminderPayload) {
  const { data, error } = await supabase.functions.invoke("send-individual-reminder", { body: invokeBody(payload) });
  if (error) throw error;
  return data as { results?: Record<string, boolean> };
}

export async function sendBulkReminder(payload: BulkReminderPayload) {
  const { data, error } = await supabase.functions.invoke("send-bulk-attendee-reminder", { body: invokeBody(payload) });
  if (error) throw error;
  return data as { recipientCount: number };
}

export async function sendAudienceInvite(payload: AudienceInvitePayload) {
  const { data, error } = await supabase.functions.invoke("send-audience-invite", { body: invokeBody(payload) });
  if (error) throw error;
  return data as { recipientCount: number };
}
