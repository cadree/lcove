import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EventEmailBranding {
  event_id: string;
  from_name_override: string | null;
  organizer_name: string | null;
  reply_to_email: string | null;
  reply_to_verified_at: string | null;
  signature: string | null;
  header_image_url: string | null;
  brand_color: string | null;
  personal_note: string | null;
}

export function useEventEmailBranding(eventId: string | undefined) {
  const [branding, setBranding] = useState<EventEmailBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data } = await supabase
      .from("event_email_branding" as any)
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    setBranding((data as any) || null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<EventEmailBranding>) => {
      if (!eventId) return;
      const { error } = await supabase
        .from("event_email_branding" as any)
        .upsert({ event_id: eventId, ...patch }, { onConflict: "event_id" });
      if (error) throw error;
      await refresh();
    },
    [eventId, refresh]
  );

  return { branding, loading, save, refresh };
}
