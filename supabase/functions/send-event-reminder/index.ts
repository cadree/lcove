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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { eventId, message, sendSms = false, recipientUserIds, recipientRsvpIds } = await req.json();
    if (!eventId) throw new Error("Missing eventId");
    const userIdFilter: string[] | null = Array.isArray(recipientUserIds) && recipientUserIds.length > 0 ? recipientUserIds : null;
    const rsvpIdFilter: string[] | null = Array.isArray(recipientRsvpIds) && recipientRsvpIds.length > 0 ? recipientRsvpIds : null;

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, start_date, end_date, venue, city, creator_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");
    if (event.creator_id !== user.id) throw new Error("Only the host can send reminders");

    let rsvpQuery = supabaseAdmin
      .from("event_rsvps")
      .select("id, user_id, guest_email, guest_name, guest_phone, reminder_enabled")
      .eq("event_id", eventId);

    if (rsvpIdFilter) {
      rsvpQuery = rsvpQuery.in("id", rsvpIdFilter);
    } else if (userIdFilter) {
      rsvpQuery = rsvpQuery.in("user_id", userIdFilter);
    } else {
      rsvpQuery = rsvpQuery.eq("status", "going");
    }

    const { data: rsvps, error: rsvpError } = await rsvpQuery;

    if (rsvpError) throw new Error("Failed to fetch attendees");
    if (!rsvps || rsvps.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0, smsSentCount: 0, message: "No attendees to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    const eventDate = new Date(event.start_date).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    const eventTime = new Date(event.start_date).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
    const location = [event.venue, event.city].filter(Boolean).join(", ") || "Location TBA";
    const eventUrl = `https://etherbylcove.com/event/${eventId}`;

    let sentCount = 0;
    let smsSentCount = 0;

    for (const rsvp of rsvps) {
      let email: string | null = null;
      let phone: string | null = rsvp.guest_phone || null;
      let name = "there";

      if (rsvp.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, phone")
          .eq("user_id", rsvp.user_id)
          .single();
        name = profile?.display_name || "there";
        if (!phone && profile?.phone) phone = profile.phone;

        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(rsvp.user_id);
        email = userData?.user?.email || null;
      } else if (rsvp.guest_email) {
        email = rsvp.guest_email;
        name = rsvp.guest_name || "there";
      }

      // Send email
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
              subject: `Reminder: ${event.title} is coming up!`,
              html: htmlBody,
            }),
          });

          if (emailRes.ok) {
            sentCount++;
            logStep("Email sent", { email });
          } else {
            logStep("Email failed", { email, error: await emailRes.text() });
          }
        } catch (err) {
          logStep("Email error", { email, error: String(err) });
        }
      }

      // Send SMS if requested and phone available
      if (sendSms && phone && twilioSid && twilioAuth && twilioPhone) {
        try {
          const smsBody = message
            ? `${message}\n\n${event.title}\n📅 ${eventDate} at ${eventTime}\n📍 ${location}\n\nRSVP: ${eventUrl}`
            : `Reminder: ${event.title} is coming up!\n📅 ${eventDate} at ${eventTime}\n📍 ${location}\n\nRSVP: ${eventUrl}`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
          const smsRes = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: twilioPhone,
              Body: smsBody,
            }),
          });

          if (smsRes.ok) {
            smsSentCount++;
            logStep("SMS sent", { phone });
          } else {
            logStep("SMS failed", { phone, status: smsRes.status });
          }
        } catch (err) {
          logStep("SMS error", { phone, error: String(err) });
        }
      }
    }

    // Send push notifications to guest subscribers (only when not filtering by recipient)
    let pushSentCount = 0;
    if (!userIdFilter && !rsvpIdFilter) {
    try {
      const { data: guestSubs } = await supabaseAdmin
        .from("guest_push_subscriptions")
        .select("endpoint, p256dh, auth, guest_email")
        .eq("event_id", eventId);

      if (guestSubs && guestSubs.length > 0) {
        const pushPayload = JSON.stringify({
          title: `Reminder: ${event.title}`,
          body: message || `${eventDate} at ${eventTime} — ${location}`,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: `ether-event-reminder-${eventId}`,
          renotify: true,
          data: { url: eventUrl, type: "event_reminder" },
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
                TTL: "86400",
                Urgency: "high",
              },
              body: pushPayload,
            });
            if (response.status === 201 || response.status === 200) {
              pushSentCount++;
            } else if (response.status === 410 || response.status === 404) {
              expiredEndpoints.push(sub.endpoint);
            }
          } catch (err) {
            logStep("Guest push error", { error: String(err) });
          }
        }
        if (expiredEndpoints.length > 0) {
          await supabaseAdmin.from("guest_push_subscriptions").delete().in("endpoint", expiredEndpoints);
        }
      }
    } catch (err) {
      logStep("Push notification error", { error: String(err) });
    }

    // Log reminder
    await supabaseAdmin.from("event_reminder_log").insert({
      event_id: eventId,
      reminder_type: "custom",
      recipient_count: sentCount + smsSentCount,
      message: message || null,
      sent_by: user.id,
    });

    logStep("Complete", { emailsSent: sentCount, smsSent: smsSentCount, pushSent: pushSentCount });

    return new Response(
      JSON.stringify({ success: true, sentCount, smsSentCount, pushSentCount, totalAttendees: rsvps.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
