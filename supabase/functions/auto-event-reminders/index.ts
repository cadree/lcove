import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[AUTO-EVENT-REMINDERS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // Check for events in 24h and 1h windows
    const windows = [
      { type: "24h", hoursAhead: 24, toleranceMinutes: 20 },
      { type: "1h", hoursAhead: 1, toleranceMinutes: 20 },
    ];

    let totalSent = 0;

    for (const window of windows) {
      const targetTime = new Date(now.getTime() + window.hoursAhead * 60 * 60 * 1000);
      const windowStart = new Date(targetTime.getTime() - window.toleranceMinutes * 60 * 1000);
      const windowEnd = new Date(targetTime.getTime() + window.toleranceMinutes * 60 * 1000);

      // Find events in this window
      const { data: events, error: eventsError } = await supabaseAdmin
        .from("events")
        .select("id, title, start_date, end_date, venue, city, state, creator_id")
        .gte("start_date", windowStart.toISOString())
        .lte("start_date", windowEnd.toISOString());

      if (eventsError || !events || events.length === 0) {
        log(`No events in ${window.type} window`);
        continue;
      }

      for (const event of events) {
        // Check if reminder already sent
        const { data: existingLog } = await supabaseAdmin
          .from("event_reminder_log")
          .select("id")
          .eq("event_id", event.id)
          .eq("reminder_type", window.type)
          .maybeSingle();

        if (existingLog) {
          log(`Already sent ${window.type} for event ${event.id}`);
          continue;
        }

        // Get attendees
        const { data: rsvps } = await supabaseAdmin
          .from("event_rsvps")
          .select("user_id, guest_email, guest_name, guest_phone, reminder_enabled")
          .eq("event_id", event.id)
          .eq("status", "going");

        if (!rsvps || rsvps.length === 0) continue;

        const eventDate = new Date(event.start_date);
        const dateStr = eventDate.toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric",
        });
        const timeStr = eventDate.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        });
        const location = [event.venue, event.city].filter(Boolean).join(", ") || "Location TBA";
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const eventUrl = `https://etherbylcove.com/event/${event.id}`;
        const timeLabel = window.type === "24h" ? "tomorrow" : "in 1 hour";

        let sentCount = 0;

        for (const rsvp of rsvps) {
          let email: string | null = null;
          let name = "there";

          if (rsvp.user_id) {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("display_name")
              .eq("user_id", rsvp.user_id)
              .single();
            name = profile?.display_name || "there";
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(rsvp.user_id);
            email = userData?.user?.email || null;

            // Also create in-app notification
            await supabaseAdmin.from("notifications").insert({
              user_id: rsvp.user_id,
              type: "event_reminder",
              title: `${event.title} is ${timeLabel}!`,
              body: `${dateStr} at ${timeStr} — ${location}`,
              data: { event_id: event.id },
            });
          } else if (rsvp.guest_email) {
            email = rsvp.guest_email;
            name = rsvp.guest_name || "there";
          }

          if (email && resendKey) {
            try {
              const htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1a1a2e;">Your event is ${timeLabel}! 🎉</h2>
                  <p>Hey ${name},</p>
                  <p>Just a friendly reminder that <strong>${event.title}</strong> is happening ${timeLabel}.</p>
                  <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 16px 0;">
                    <h3 style="margin: 0 0 8px;">${event.title}</h3>
                    <p style="margin: 4px 0; color: #666;">📅 ${dateStr} at ${timeStr}</p>
                    <p style="margin: 4px 0; color: #666;">📍 ${location}</p>
                  </div>
                  <a href="${eventUrl}" style="display: inline-block; background: #e91e8c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    View Event Details
                  </a>
                  <p style="color: #999; font-size: 12px; margin-top: 24px;">Sent via ETHER by lcove</p>
                </div>`;

              const emailRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "notifications@etherbylcove.com",
                  to: [email],
                  subject: `Reminder: ${event.title} is ${timeLabel}!`,
                  html: htmlBody,
                }),
              });

              if (emailRes.ok) sentCount++;
            } catch (err) {
              log("Email error", { error: String(err) });
            }
          }
        }

        // Log that reminder was sent (use service role to bypass RLS)
        await supabaseAdmin.from("event_reminder_log").insert({
          event_id: event.id,
          reminder_type: window.type,
          recipient_count: sentCount,
          sent_by: null, // automated
        });

        totalSent += sentCount;
        log(`Sent ${window.type} reminders for "${event.title}"`, { sentCount });
      }
    }

    log("Complete", { totalSent });

    return new Response(JSON.stringify({ success: true, totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
