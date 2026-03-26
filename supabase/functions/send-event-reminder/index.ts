import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-EVENT-REMINDER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate the sender (event host)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { eventId, message } = await req.json();
    if (!eventId) throw new Error("Missing eventId");

    // Fetch event
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, start_date, end_date, venue, city, creator_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");
    if (event.creator_id !== user.id) throw new Error("Only the host can send reminders");

    // Fetch all RSVPs (both members and guests)
    const { data: rsvps, error: rsvpError } = await supabaseAdmin
      .from("event_rsvps")
      .select("user_id, guest_email, guest_name, guest_phone, reminder_enabled")
      .eq("event_id", eventId)
      .eq("status", "going");

    if (rsvpError) throw new Error("Failed to fetch attendees");
    if (!rsvps || rsvps.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0, message: "No attendees to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const eventDate = new Date(event.start_date).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    const eventTime = new Date(event.start_date).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
    const location = [event.venue, event.city].filter(Boolean).join(", ") || "Location TBA";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const eventUrl = `${supabaseUrl}/functions/v1/share-page/e/${eventId}`;

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
      } else if (rsvp.guest_email) {
        email = rsvp.guest_email;
        name = rsvp.guest_name || "there";
      }

      if (email && resendKey) {
        try {
          const customMessage = message ? `<p style="margin: 16px 0; padding: 12px; background: #f0f0f0; border-radius: 8px;">"${message}"</p>` : "";

          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a2e;">Event Reminder 🎉</h2>
              <p>Hey ${name},</p>
              <p>Just a reminder about your upcoming event:</p>
              ${customMessage}
              <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 16px 0;">
                <h3 style="margin: 0 0 8px;">${event.title}</h3>
                <p style="margin: 4px 0; color: #666;">📅 ${eventDate} at ${eventTime}</p>
                <p style="margin: 4px 0; color: #666;">📍 ${location}</p>
              </div>
              <a href="${eventUrl}" style="display: inline-block; background: #e91e8c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Event Details
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 24px;">Sent via ETHER by lcove</p>
            </div>
          `;

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "notifications@etherbylcove.com",
              to: [email],
              subject: `Reminder: ${event.title} is coming up!`,
              html: htmlBody,
            }),
          });

          if (emailRes.ok) {
            sentCount++;
            logStep("Reminder sent", { email });
          } else {
            logStep("Reminder failed", { email, error: await emailRes.text() });
          }
        } catch (err) {
          logStep("Reminder error", { email, error: String(err) });
        }
      }
    }

    // --- Send push notifications to guest subscribers ---
    let pushSentCount = 0;
    try {
      const { data: guestSubs, error: guestSubError } = await supabaseAdmin
        .from("guest_push_subscriptions")
        .select("endpoint, p256dh, auth, guest_email")
        .eq("event_id", eventId);

      if (!guestSubError && guestSubs && guestSubs.length > 0) {
        logStep("Found guest push subscriptions", { count: guestSubs.length });

        const pushPayload = JSON.stringify({
          title: `Reminder: ${event.title}`,
          body: message || `${eventDate} at ${eventTime} — ${location}`,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: `ether-event-reminder-${eventId}`,
          renotify: true,
          data: {
            url: eventUrl,
            type: "event_reminder",
          },
          vibrate: [200, 100, 200],
          timestamp: Date.now(),
        });

        const expiredEndpoints: string[] = [];

        for (const sub of guestSubs) {
          try {
            const response = await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": String(new TextEncoder().encode(pushPayload).length),
                "TTL": "86400",
                "Urgency": "high",
              },
              body: pushPayload,
            });

            if (response.status === 201 || response.status === 200) {
              pushSentCount++;
              logStep("Guest push sent", { email: sub.guest_email });
            } else if (response.status === 410 || response.status === 404) {
              expiredEndpoints.push(sub.endpoint);
              logStep("Guest push subscription expired", { email: sub.guest_email });
            } else {
              logStep("Guest push failed", { email: sub.guest_email, status: response.status });
            }
          } catch (err) {
            logStep("Guest push error", { email: sub.guest_email, error: String(err) });
          }
        }

        // Clean up expired guest subscriptions
        if (expiredEndpoints.length > 0) {
          await supabaseAdmin
            .from("guest_push_subscriptions")
            .delete()
            .in("endpoint", expiredEndpoints);
          logStep("Cleaned up expired guest subscriptions", { count: expiredEndpoints.length });
        }
      }
    } catch (err) {
      logStep("Guest push notification error", { error: String(err) });
    }

    logStep("Complete", { totalAttendees: rsvps.length, emailsSent: sentCount, pushSent: pushSentCount });

    return new Response(
      JSON.stringify({ success: true, sentCount, pushSentCount, totalAttendees: rsvps.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
