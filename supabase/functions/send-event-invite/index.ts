import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveHostIdentity } from "../_shared/host-email-identity.ts";
import { buildHostEventEmail } from "../_shared/host-event-email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-EVENT-INVITE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { eventId, invitees } = await req.json();
    if (!eventId) throw new Error("Missing eventId");
    if (!invitees || !Array.isArray(invitees) || invitees.length === 0) {
      throw new Error("At least one invitee required");
    }
    if (invitees.length > 50) throw new Error("Maximum 50 invitations at a time");

    logStep("Params", { eventId, inviteeCount: invitees.length });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, start_date, end_date, venue, city, creator_id, ticket_price, is_public, image_url")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");
    if (event.creator_id !== user.id) {
      throw new Error("Only the event host can send invitations");
    }

    const identity = await resolveHostIdentity(supabaseAdmin, eventId);

    // Optional moodboard previews
    const { data: moodItems } = await supabaseAdmin
      .from("event_moodboard_items")
      .select("file_url, mime_type")
      .eq("event_id", eventId)
      .limit(6);
    const moodboardThumbnails = (moodItems || [])
      .filter((m: any) => (m.mime_type || "").startsWith("image/"))
      .slice(0, 3)
      .map((m: any) => m.file_url);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const results: Array<{ email?: string; phone?: string; status: string; error?: string }> = [];

    const eventUrl = `https://etherbylcove.com/event/${eventId}`;
    const isFree = !event.ticket_price || event.ticket_price <= 0;
    const eventDate = new Date(event.start_date).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    const eventTime = new Date(event.start_date).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
    const location = [event.venue, event.city].filter(Boolean).join(", ") || "Location TBA";

    for (const invitee of invitees) {
      if (invitee.email && resendKey) {
        try {
          const { subject, html, text } = buildHostEventEmail("invite", {
            identity,
            recipientName: invitee.name,
            eventTitle: event.title,
            eventDate,
            eventTime,
            location,
            isFree,
            ticketPrice: event.ticket_price,
            eventUrl,
            moodboardThumbnails,
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: identity.fromHeader,
              to: [invitee.email],
              reply_to: identity.replyTo,
              subject,
              html,
              text,
            }),
          });

          if (emailRes.ok) {
            results.push({ email: invitee.email, status: "sent" });
            logStep("Email sent", { email: invitee.email, from: identity.fromHeader });
          } else {
            const errText = await emailRes.text();
            results.push({ email: invitee.email, status: "failed", error: errText });
            logStep("Email failed", { email: invitee.email, error: errText });
          }
        } catch (err) {
          results.push({ email: invitee.email, status: "failed", error: String(err) });
        }
      } else if (invitee.email && !resendKey) {
        results.push({ email: invitee.email, status: "skipped", error: "Email not configured" });
      }

      if (invitee.phone) {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (twilioSid && twilioAuth && twilioPhone) {
          try {
            const smsBody = `${identity.organizerName} invited you to "${event.title}" on ${eventDate} at ${eventTime}. ${location}. ${isFree ? "RSVP" : "Get tickets"}: ${eventUrl}`;
            const smsRes = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: invitee.phone,
                  From: twilioPhone,
                  Body: smsBody,
                }).toString(),
              }
            );
            if (smsRes.ok) {
              results.push({ phone: invitee.phone, status: "sent" });
            } else {
              const errText = await smsRes.text();
              results.push({ phone: invitee.phone, status: "failed", error: errText });
            }
          } catch (err) {
            results.push({ phone: invitee.phone, status: "failed", error: String(err) });
          }
        } else {
          results.push({ phone: invitee.phone, status: "skipped", error: "SMS not configured" });
        }
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    logStep("Complete", { total: invitees.length, sent: sentCount, failed: failedCount });

    return new Response(
      JSON.stringify({ success: true, results, sentCount, failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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
