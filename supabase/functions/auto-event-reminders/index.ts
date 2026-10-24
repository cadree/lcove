import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireInternalSecret } from "../_shared/require-caller.ts";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-internal-secret",
};

const log = (step: string, detail?: unknown) =>
  console.log(`[AUTO-EVENT-REMINDERS] ${step}${detail ? ` - ${JSON.stringify(detail)}` : ""}`);

interface PushRow {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  body: string;
  url: string;
}

// Dashboard cron POSTs this function with x-internal-secret. pg_cron also runs
// dispatch_attendee_event_reminders every minute. Both paths claim the same
// send row, so a reminder is not sent twice. This function delivers the
// queued rows through the existing send-push-notification function.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: claimed, error: claimError } = await admin.rpc("dispatch_attendee_event_reminders");
    if (claimError) throw new Error(claimError.message);
    log("Claimed", { claimed });

    const { data: pending, error: pendingError } = await admin
      .from("attendee_event_reminder_pushes")
      .select("id, user_id, event_id, title, body, url")
      .is("sent_at", null)
      .order("created_at", { ascending: true })
      .limit(50);
    if (pendingError) throw new Error(pendingError.message);

    let pushed = 0;
    for (const row of (pending ?? []) as PushRow[]) {
      const claimedAt = new Date().toISOString();
      const { data: locked, error: lockError } = await admin
        .from("attendee_event_reminder_pushes")
        .update({ sent_at: claimedAt })
        .eq("id", row.id)
        .is("sent_at", null)
        .select("id");
      if (lockError || !locked || locked.length === 0) continue;

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: row.user_id,
            notification_type: "event_reminder",
            title: row.title,
            body: row.body,
            url: row.url,
            data: { event_id: row.event_id, type: "event_reminder", url: row.url },
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          log("Push failed", { id: row.id, status: response.status, text });
          await admin.from("attendee_event_reminder_pushes").update({ sent_at: null }).eq("id", row.id);
          continue;
        }
        pushed += 1;
      } catch (error) {
        log("Push error", { id: row.id, error: String(error) });
        await admin.from("attendee_event_reminder_pushes").update({ sent_at: null }).eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({ success: true, claimed, pushed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: httpStatusForError(err),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
