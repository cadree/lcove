import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: any) =>
  console.log(`[SEND-BULK-REMINDER] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

interface Body {
  eventId: string;
  title: string;
  body: string;
  channels?: { push?: boolean; email?: boolean; sms?: boolean };
  filter?: {
    tierIds?: string[];
    status?: string[]; // confirmed, checked_in
    purchasedAfter?: string;
    purchasedBefore?: string;
  };
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
    const { data: { user }, error: ue } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !user) throw new Error("Not authenticated");

    const body: Body = await req.json();
    if (!body.eventId || !body.title || !body.body) throw new Error("Missing fields");

    const { data: canManage } = await admin.rpc("can_manage_event", {
      p_event_id: body.eventId, p_user_id: user.id,
    });
    if (!canManage) throw new Error("Not authorized");

    const { data: event } = await admin
      .from("events")
      .select("id, title, start_date, venue, city")
      .eq("id", body.eventId)
      .single();
    if (!event) throw new Error("Event not found");

    // Build attendee query
    let q = admin.from("event_attendees")
      .select("id, attendee_user_id, attendee_email, attendee_name, attendee_phone, tier_id, status, created_at")
      .eq("event_id", body.eventId);

    const statuses = body.filter?.status?.length ? body.filter.status : ["confirmed", "checked_in"];
    q = q.in("status", statuses);
    if (body.filter?.tierIds?.length) q = q.in("tier_id", body.filter.tierIds);
    if (body.filter?.purchasedAfter) q = q.gte("created_at", body.filter.purchasedAfter);
    if (body.filter?.purchasedBefore) q = q.lte("created_at", body.filter.purchasedBefore);

    const { data: attendees } = await q;
    if (!attendees || attendees.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channels = body.channels || { push: true, email: true, sms: false };
    const eventTime = new Date(event.start_date).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const eventUrl = `https://etherbylcove.com/event/${event.id}`;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // Campaign row
    const { data: campaign } = await admin.from("notification_campaigns").insert({
      host_user_id: user.id,
      event_id: body.eventId,
      type: "reminder",
      title: body.title,
      body: body.body,
      channels: Object.entries(channels).filter(([_, v]) => v).map(([k]) => k),
      audience_filter: body.filter || {},
      recipient_count: attendees.length,
    }).select().single();

    let sentCount = 0;
    const seen = new Set<string>();

    for (const a of attendees) {
      const dedupKey = `${a.attendee_user_id || ""}:${(a.attendee_email || "").toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      let email = a.attendee_email || null;
      let phone = a.attendee_phone || null;
      let displayName = a.attendee_name || "there";

      if (a.attendee_user_id) {
        if (!email) {
          const { data: u } = await admin.auth.admin.getUserById(a.attendee_user_id);
          email = u?.user?.email || null;
        }
        const { data: profile } = await admin
          .from("profiles").select("display_name, phone")
          .eq("user_id", a.attendee_user_id).maybeSingle();
        if (profile?.display_name) displayName = profile.display_name;
        if (!phone && profile?.phone) phone = profile.phone;
      }

      const firstName = displayName.split(" ")[0];
      const vars = {
        first_name: firstName,
        event_name: event.title,
        event_time: eventTime,
        ticket_type: "ticket",
      };
      const finalTitle = substitute(body.title, vars);
      const finalBody = substitute(body.body, vars);

      const logRow = (channel: string, status: string, error?: string) =>
        admin.from("notification_logs").insert({
          campaign_id: campaign?.id || null,
          host_user_id: user.id,
          user_id: a.attendee_user_id || null,
          recipient_email: email, recipient_phone: phone,
          event_id: body.eventId, type: "reminder", channel, status,
          error_message: error || null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        });

      // In-app
      if (a.attendee_user_id) {
        await admin.from("notifications").insert({
          user_id: a.attendee_user_id, type: "event_reminder",
          title: finalTitle, body: finalBody, data: { event_id: body.eventId },
        });
        await logRow("in_app", "sent");
      }

      // Push
      if (channels.push && a.attendee_user_id) {
        try {
          await admin.functions.invoke("send-push-notification", {
            body: { event_id: body.eventId, user_id: a.attendee_user_id, title: finalTitle, body: finalBody, url: `/event/${body.eventId}` },
          });
          await logRow("push", "sent");
          sentCount++;
        } catch (e) { await logRow("push", "failed", String(e)); }
      }

      // Email
      if (channels.email && email && resendKey) {
        try {
          const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h1 style="color:#1a1a2e;">${finalTitle}</h1>
            <p style="color:#555;line-height:1.6;">${finalBody.replace(/\n/g, "<br/>")}</p>
            <a href="${eventUrl}" style="display:inline-block;background:#e91e8c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">View Event</a>
          </div>`;
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: "notifications@etherbylcove.com", to: [email], subject: finalTitle, html }),
          });
          if (r.ok) { await logRow("email", "sent"); sentCount++; }
          else await logRow("email", "failed", `${r.status}`);
        } catch (e) { await logRow("email", "failed", String(e)); }
      }

      // SMS
      if (channels.sms && phone) {
        const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
        const from = Deno.env.get("TWILIO_PHONE_NUMBER");
        if (sid && auth && from) {
          try {
            const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
              method: "POST",
              headers: { Authorization: `Basic ${btoa(`${sid}:${auth}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ To: phone, From: from, Body: `${finalTitle}\n\n${finalBody}\n\n${eventUrl}` }),
            });
            if (r.ok) { await logRow("sms", "sent"); sentCount++; }
            else await logRow("sms", "failed", `${r.status}`);
          } catch (e) { await logRow("sms", "failed", String(e)); }
        }
      }

      // Throttle
      await new Promise(r => setTimeout(r, 80));
    }

    if (campaign?.id) {
      await admin.from("notification_campaigns").update({ sent_count: sentCount }).eq("id", campaign.id);
    }

    log("Done", { recipients: attendees.length, sentCount });
    return new Response(JSON.stringify({ success: true, recipientCount: attendees.length, sentCount, campaignId: campaign?.id }), {
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
