import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: any) =>
  console.log(`[AUTO-EVENT-REMINDERS] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

interface Window {
  type: string;
  hoursAhead: number;
  toleranceMin: number;
  label: string;
}

const WINDOWS: Window[] = [
  { type: "1week", hoursAhead: 168, toleranceMin: 30, label: "in 1 week" },
  { type: "1day", hoursAhead: 24, toleranceMin: 30, label: "tomorrow" },
  { type: "5hour", hoursAhead: 5, toleranceMin: 30, label: "in 5 hours" },
  { type: "30min", hoursAhead: 0.5, toleranceMin: 10, label: "in 30 minutes" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    log("Started");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let totalSent = 0;

    for (const win of WINDOWS) {
      const target = new Date(now.getTime() + win.hoursAhead * 60 * 60 * 1000);
      const startWin = new Date(target.getTime() - win.toleranceMin * 60 * 1000);
      const endWin = new Date(target.getTime() + win.toleranceMin * 60 * 1000);

      const { data: events } = await admin
        .from("events")
        .select("id, title, start_date, end_date, venue, city, state, image_url, description")
        .gte("start_date", startWin.toISOString())
        .lte("start_date", endWin.toISOString());

      if (!events || events.length === 0) continue;

      for (const event of events) {
        const { data: rsvps } = await admin
          .from("event_rsvps")
          .select("user_id, guest_email, guest_name, reminder_enabled")
          .eq("event_id", event.id)
          .eq("status", "going");

        if (!rsvps || rsvps.length === 0) continue;

        const start = new Date(event.start_date);
        const dateStr = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        const timeStr = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const location = [event.venue, event.city].filter(Boolean).join(", ") || "Location TBA";
        const eventUrl = `https://etherbylcove.com/event/${event.id}`;

        for (const rsvp of rsvps) {
          if (rsvp.reminder_enabled === false) continue;

          let email: string | null = null;
          let name = "there";

          if (rsvp.user_id) {
            const { data: profile } = await admin
              .from("profiles")
              .select("display_name")
              .eq("user_id", rsvp.user_id)
              .maybeSingle();
            name = profile?.display_name || "there";
            const { data: u } = await admin.auth.admin.getUserById(rsvp.user_id);
            email = u?.user?.email || null;
          } else if (rsvp.guest_email) {
            email = rsvp.guest_email;
            name = rsvp.guest_name || "there";
          }

          if (!email) continue;

          // Per-recipient dedupe
          const { data: existing } = await admin
            .from("event_reminder_log")
            .select("id")
            .eq("event_id", event.id)
            .eq("reminder_type", win.type)
            .eq("recipient_email", email)
            .maybeSingle();

          if (existing) continue;

          // Send in-app notification
          if (rsvp.user_id) {
            await admin.from("notifications").insert({
              user_id: rsvp.user_id,
              type: "event_reminder",
              title: `${event.title} is ${win.label}`,
              body: `${dateStr} at ${timeStr} — ${location}`,
              data: { event_id: event.id },
            });
          }

          // Send email
          if (resendKey) {
            try {
              const html = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
                  <h1 style="color:#1a1a2e;margin:0 0 8px;">${event.title} is ${win.label} 🎉</h1>
                  <p style="color:#555;margin:0 0 20px;">Hey ${name}, just a friendly reminder.</p>
                  ${event.image_url ? `<img src="${event.image_url}" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;margin-bottom:16px" />` : ''}
                  <div style="background:#f8f8f8;border-radius:12px;padding:20px;margin:16px 0;">
                    <h2 style="margin:0 0 8px;color:#1a1a2e;">${event.title}</h2>
                    <p style="margin:4px 0;color:#555;">📅 ${dateStr} at ${timeStr}</p>
                    <p style="margin:4px 0;color:#555;">📍 ${location}</p>
                  </div>
                  <a href="${eventUrl}" style="display:inline-block;background:#e91e8c;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Event</a>
                  <p style="color:#888;font-size:12px;margin-top:24px;">— ETHER by lcove</p>
                </div>`;

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "notifications@etherbylcove.com",
                  to: [email],
                  subject: `${event.title} is ${win.label}`,
                  html,
                }),
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

    log("Complete", { totalSent });
    return new Response(JSON.stringify({ success: true, totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
