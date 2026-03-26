import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    // Authenticate the sender
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { eventId, invitees } = await req.json();
    // invitees: Array<{ email?: string; phone?: string; name?: string }>

    if (!eventId) throw new Error("Missing eventId");
    if (!invitees || !Array.isArray(invitees) || invitees.length === 0) {
      throw new Error("At least one invitee required");
    }
    if (invitees.length > 50) {
      throw new Error("Maximum 50 invitations at a time");
    }

    logStep("Params", { eventId, inviteeCount: invitees.length });

    // Fetch event details
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, start_date, end_date, venue, city, creator_id, ticket_price, is_public")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    // Verify sender is the event creator or has permission
    if (event.creator_id !== user.id) {
      throw new Error("Only the event host can send invitations");
    }

    // Get sender profile
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const senderName = senderProfile?.display_name || "Someone";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const results: Array<{ email?: string; phone?: string; status: string; error?: string }> = [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const eventUrl = `${supabaseUrl}/functions/v1/share-page/e/${eventId}`;

    const isFree = !event.ticket_price || event.ticket_price <= 0;
    const eventDate = new Date(event.start_date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const eventTime = new Date(event.start_date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const location = [event.venue, event.city].filter(Boolean).join(", ") || "Location TBA";

    // Send email invitations
    for (const invitee of invitees) {
      if (invitee.email && resendKey) {
        try {
          const inviteeName = invitee.name || "there";
          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a2e;">You're Invited!</h2>
              <p>Hey ${inviteeName},</p>
              <p><strong>${senderName}</strong> has invited you to:</p>
              <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 16px 0;">
                <h3 style="margin: 0 0 8px;">${event.title}</h3>
                <p style="margin: 4px 0; color: #666;">📅 ${eventDate} at ${eventTime}</p>
                <p style="margin: 4px 0; color: #666;">📍 ${location}</p>
                ${!isFree ? `<p style="margin: 4px 0; color: #666;">🎟️ Tickets: $${event.ticket_price}</p>` : '<p style="margin: 4px 0; color: #666;">🎟️ Free Event</p>'}
              </div>
              <a href="${eventUrl}" style="display: inline-block; background: #e91e8c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                ${isFree ? "RSVP Now" : "Get Tickets"}
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 24px;">
                Sent via ETHER by lcove
              </p>
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
              to: [invitee.email],
              subject: `${senderName} invited you to ${event.title}`,
              html: htmlBody,
            }),
          });

          if (emailRes.ok) {
            results.push({ email: invitee.email, status: "sent" });
            logStep("Email sent", { email: invitee.email });
          } else {
            const errText = await emailRes.text();
            results.push({ email: invitee.email, status: "failed", error: errText });
            logStep("Email failed", { email: invitee.email, error: errText });
          }
        } catch (err) {
          results.push({ email: invitee.email, status: "failed", error: String(err) });
        }
      }

      // Send SMS invitation if phone provided
      if (invitee.phone) {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (twilioSid && twilioAuth && twilioPhone) {
          try {
            const smsBody = `${senderName} invited you to "${event.title}" on ${eventDate} at ${eventTime}. ${location}. ${isFree ? "RSVP" : "Get tickets"}: ${eventUrl}`;

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
              logStep("SMS sent", { phone: invitee.phone });
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
    logStep("Complete", { total: invitees.length, sent: sentCount });

    return new Response(
      JSON.stringify({ success: true, results, sentCount }),
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
