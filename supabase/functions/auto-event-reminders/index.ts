import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { eventDateLabel, eventTimeLabel } from "../_shared/event-time.mjs";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveHostIdentity } from "../_shared/host-email-identity.ts";
import { guestEventEmailHtml } from "../_shared/guest-event-email.mjs";
import { unsubscribeLink } from "../_shared/unsubscribe-link.mjs";
import { requireInternalSecret } from "../_shared/require-caller.ts";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[AUTO-EVENT-REMINDERS] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

interface ReminderSettingsRow {
  event_id: string;
  enabled_24h?: boolean | null;
  enabled_2h?: boolean | null;
  enabled_at_door?: boolean | null;
}

function asReminderSettings(value: unknown): ReminderSettingsRow[] {
  return Array.isArray(value) ? value as unknown as ReminderSettingsRow[] : [];
}

interface Window {
  type: string;
  hoursAhead: number;
  toleranceMin: number;
  label: string;
}

const WINDOWS: Window[] = [
  { type: "1week", hoursAhead: 168, toleranceMin: 30, label: "in 1 week" },
  { type: "1day", hoursAhead: 24, toleranceMin: 30, label: "tomorrow" },
  { type: "2hour", hoursAhead: 2, toleranceMin: 15, label: "in 2 hours" },
  { type: "starting_now", hoursAhead: 0, toleranceMin: 10, label: "starting now" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;

  try {
    log("Started");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let totalSent = 0;
    let totalPushed = 0;

    for (const win of WINDOWS) {
      const target = new Date(now.getTime() + win.hoursAhead * 60 * 60 * 1000);
      const startWin = new Date(target.getTime() - win.toleranceMin * 60 * 1000);
      const endWin = new Date(target.getTime() + win.toleranceMin * 60 * 1000);

      const { data: events } = await admin
        .from("events")
        .select("id, title, start_date, end_date, venue, address, city, state, image_url, description, timezone")
        .gte("start_date", startWin.toISOString())
        .lte("start_date", endWin.toISOString());

      if (!events || events.length === 0) continue;

      // Gate by per-event auto-reminder toggles (default ON if no row exists)
      const eventIds = events.map(e => e.id);
      const { data: settingsRows } = await admin
        .from("event_auto_reminders")
        .select("event_id, enabled_24h, enabled_2h, enabled_at_door, last_24h_sent_at, last_2h_sent_at")
        .in("event_id", eventIds);
      const settingsMap = new Map(asReminderSettings(settingsRows).map((r) => [r.event_id, r]));
      const isEnabled = (eid: string) => {
        const s = settingsMap.get(eid);
        if (!s) return true;
        if (win.type === "1day") return s.enabled_24h !== false;
        if (win.type === "2hour") return s.enabled_2h !== false;
        if (win.type === "starting_now") return s.enabled_at_door !== false;
        return true;
      };

      for (const event of events) {
        if (!isEnabled(event.id)) continue;
        // Pull attendees from new schema (event_attendees) — confirmed/checked_in only
        const { data: attendees } = await admin
          .from("event_attendees")
          .select("id, attendee_user_id, attendee_name, attendee_email, status")
          .eq("event_id", event.id)
          .in("status", ["confirmed", "checked_in"]);

        // Also pull legacy RSVPs that opted in
        const { data: rsvps } = await admin
          .from("event_rsvps")
          .select("user_id, guest_email, guest_name, reminder_enabled")
          .eq("event_id", event.id)
          .eq("status", "going");

        // Build a unified recipient list, dedupe by email
        const recipients = new Map<string, { user_id: string | null; name: string; email: string }>();

        for (const a of attendees || []) {
          if (!a.attendee_email && !a.attendee_user_id) continue;
          let email = a.attendee_email || null;
          const name = a.attendee_name || "there";
          if (!email && a.attendee_user_id) {
            const { data: u } = await admin.auth.admin.getUserById(a.attendee_user_id);
            email = u?.user?.email || null;
          }
          if (!email) continue;
          recipients.set(email.toLowerCase(), { user_id: a.attendee_user_id, name, email });
        }

        for (const r of rsvps || []) {
          if (r.reminder_enabled === false) continue;
          let email = r.guest_email || null;
          let name = r.guest_name || "there";
          if (!email && r.user_id) {
            const { data: profile } = await admin
              .from("profiles")
              .select("display_name")
              .eq("user_id", r.user_id)
              .maybeSingle();
            name = profile?.display_name || name;
            const { data: u } = await admin.auth.admin.getUserById(r.user_id);
            email = u?.user?.email || null;
          }
          if (!email) continue;
          const key = email.toLowerCase();
          if (!recipients.has(key)) {
            recipients.set(key, { user_id: r.user_id, name, email });
          }
        }

        if (recipients.size === 0) continue;

        const dateStr = eventDateLabel(event.start_date, event.timezone);
        const timeStr = eventTimeLabel(event.start_date, event.timezone);
        const location = [event.venue, event.address, event.city].filter(Boolean).join(", ") || "Location TBA";
        const eventUrl = `https://etherbylcove.com/event/${event.id}`;
        const identity = await resolveHostIdentity(admin, event.id);

        for (const recipient of recipients.values()) {
          const email = recipient.email;
          // Per-recipient dedupe
          const { data: existing } = await admin
            .from("event_reminder_log")
            .select("id")
            .eq("event_id", event.id)
            .eq("reminder_type", win.type)
            .eq("recipient_email", email)
            .maybeSingle();

          if (existing) continue;

          // In-app notification
          if (recipient.user_id) {
            await admin.from("notifications").insert({
              user_id: recipient.user_id,
              type: "event_reminder",
              title: `${event.title} is ${win.label}`,
              body: `${dateStr} at ${timeStr} — ${location}`,
              data: { event_id: event.id, reminder_type: win.type },
            });
          }

          // Push notification (best-effort)
          try {
            await admin.functions.invoke("send-push-notification", {
              body: {
                event_id: event.id,
                user_id: recipient.user_id,
                guest_email: recipient.user_id ? null : email,
                title: `${event.title} is ${win.label}`,
                body: `${dateStr} at ${timeStr} — ${location}`,
                url: `/event/${event.id}`,
              },
            });
            totalPushed++;
          } catch (e) {
            log("Push failed", { email, err: String(e) });
          }

          // Email
          if (resendKey) {
            try {
              const unsub = await unsubscribeLink(admin, email);
              if (unsub.suppressed) continue;
              const html = guestEventEmailHtml({
                hostName: identity.hostDisplayName,
                hostAvatarUrl: identity.hostAvatarUrl,
                flyerUrl: identity.headerImageUrl || event.image_url,
                brandColor: identity.brandColor,
                eventTitle: event.title,
                eventDate: dateStr,
                eventTime: timeStr,
                location,
                mapUrl: `https://maps.google.com/?q=${encodeURIComponent(location)}`,
                intro: `${event.title} is ${win.label}.`,
                eventUrl,
                unsubscribeUrl: unsub.url,
              });
              const payload: Record<string, unknown> = {
                from: identity.fromHeader,
                to: [email],
                subject: `${event.title} is ${win.label}`,
                html,
              };
              if (identity.replyTo) payload.reply_to = identity.replyTo;

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!res.ok) {
                const body = await res.text();
                log("Email failed", { email, status: res.status, body });
              } else {
                totalSent++;
              }
            } catch (err) {
              log("Email error", { error: String(err) });
            }
          }

          // Record per-recipient log entry
          await admin.from("event_reminder_log").insert({
            event_id: event.id,
            reminder_type: win.type,
            recipient_email: email,
            recipient_count: 1,
            sent_by: null,
          });
        }
      }
    }

    log("Complete", { totalSent, totalPushed });
    return new Response(JSON.stringify({ success: true, totalSent, totalPushed }), {
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
