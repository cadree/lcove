import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: any) =>
  console.log(`[SEND-INDIVIDUAL-REMINDER] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

interface Body {
  eventId: string;
  attendeeEmail?: string | null;
  attendeeUserId?: string | null;
  attendeeName?: string | null;
  attendeePhone?: string | null;
  tierName?: string | null;
  channels?: { push?: boolean; email?: boolean; sms?: boolean };
  title: string;
  body: string;
}

function substitute(template: string, vars: Record<string, string>) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v ?? "");
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: ue } = await admin.auth.getUser(token);
    if (ue || !user) throw new Error("Not authenticated");

    const body: Body = await req.json();
    if (!body.eventId || !body.title || !body.body) throw new Error("Missing required fields");

    // Fetch event
    const { data: event, error: ee } = await admin
      .from("events")
      .select("id, title, start_date, venue, city, creator_id")
      .eq("id", body.eventId)
      .single();
    if (ee || !event) throw new Error("Event not found");

    // Authorization: must be able to manage this event
    const { data: canManage } = await admin.rpc("can_manage_event", {
      p_event_id: body.eventId, p_user_id: user.id,
    });
    if (!canManage) throw new Error("Not authorized");

    // Resolve recipient email/phone if user_id provided
    let email = body.attendeeEmail || null;
    let phone = body.attendeePhone || null;
    let displayName = body.attendeeName || "there";
    let pushEnabled = false;
    let emailEnabled = true;
    let smsEnabled = true;

    if (body.attendeeUserId) {
      if (!email) {
        const { data: u } = await admin.auth.admin.getUserById(body.attendeeUserId);
        email = u?.user?.email || null;
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("display_name, phone")
        .eq("user_id", body.attendeeUserId)
        .maybeSingle();
      if (profile?.display_name) displayName = profile.display_name;
      if (!phone && profile?.phone) phone = profile.phone;

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", body.attendeeUserId)
        .limit(1);
      pushEnabled = !!(subs && subs.length > 0);

      const { data: prefs } = await admin
        .from("notification_preferences")
        .select("email_enabled, push_enabled")
        .eq("user_id", body.attendeeUserId)
        .maybeSingle();
      if (prefs) {
        emailEnabled = prefs.email_enabled !== false;
        pushEnabled = pushEnabled && prefs.push_enabled !== false;
      }
    }

    const firstName = (displayName || "there").split(" ")[0];
    const eventTime = new Date(event.start_date).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const vars = {
      first_name: firstName,
      event_name: event.title,
      event_time: eventTime,
      ticket_type: body.tierName || "ticket",
    };
    const finalTitle = substitute(body.title, vars);
    const finalBody = substitute(body.body, vars);
    const eventUrl = `https://etherbylcove.com/event/${event.id}`;

    const channels = body.channels || { push: true, email: true, sms: false };
    const results = { push: false, email: false, sms: false, in_app: false };

    // Create campaign row
    const { data: campaign } = await admin
      .from("notification_campaigns")
      .insert({
        host_user_id: user.id,
        event_id: body.eventId,
        type: "individual",
        title: finalTitle,
        body: finalBody,
        channels: Object.entries(channels).filter(([_, v]) => v).map(([k]) => k),
        recipient_count: 1,
      })
      .select()
      .single();

    const logRow = async (channel: string, status: string, error?: string) => {
      await admin.from("notification_logs").insert({
        campaign_id: campaign?.id || null,
        host_user_id: user.id,
        user_id: body.attendeeUserId || null,
        recipient_email: email,
        recipient_phone: phone,
        event_id: body.eventId,
        type: "individual",
        channel,
        status,
        error_message: error || null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });
    };

    // In-app notification
    if (body.attendeeUserId) {
      await admin.from("notifications").insert({
        user_id: body.attendeeUserId,
        type: "event_reminder",
        title: finalTitle,
        body: finalBody,
        data: { event_id: body.eventId },
      });
      results.in_app = true;
      await logRow("in_app", "sent");
    }

    // Push
    if (channels.push && body.attendeeUserId && pushEnabled) {
      try {
        await admin.functions.invoke("send-push-notification", {
          body: {
            event_id: body.eventId,
            user_id: body.attendeeUserId,
            title: finalTitle,
            body: finalBody,
            url: `/event/${body.eventId}`,
          },
        });
        results.push = true;
        await logRow("push", "sent");
      } catch (e) {
        await logRow("push", "failed", String(e));
      }
    }

    // Email
    if (channels.email && email && emailEnabled) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h1 style="color:#1a1a2e;">${finalTitle}</h1>
            <p style="color:#555;line-height:1.6;">${finalBody.replace(/\n/g, "<br/>")}</p>
            <a href="${eventUrl}" style="display:inline-block;background:#e91e8c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">View Event</a>
            <p style="color:#888;font-size:12px;margin-top:24px;">— ETHER by lcove</p>
          </div>`;
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "notifications@etherbylcove.com",
              to: [email],
              subject: finalTitle,
              html,
            }),
          });
          if (r.ok) { results.email = true; await logRow("email", "sent"); }
          else await logRow("email", "failed", await r.text());
        } catch (e) { await logRow("email", "failed", String(e)); }
      }
    }

    // SMS
    if (channels.sms && phone && smsEnabled) {
      const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const from = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (sid && auth && from) {
        try {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${sid}:${auth}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone, From: from,
              Body: `${finalTitle}\n\n${finalBody}\n\n${eventUrl}`,
            }),
          });
          if (r.ok) { results.sms = true; await logRow("sms", "sent"); }
          else await logRow("sms", "failed", `${r.status}`);
        } catch (e) { await logRow("sms", "failed", String(e)); }
      }
    }

    const sentCount = Object.values(results).filter(Boolean).length;
    if (campaign?.id) {
      await admin.from("notification_campaigns").update({ sent_count: sentCount }).eq("id", campaign.id);
    }

    log("Sent", { results });
    return new Response(JSON.stringify({ success: true, results, campaignId: campaign?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
