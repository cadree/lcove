import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { eventDateLabel, eventTimeLabel } from "../_shared/event-time.mjs";
import { getBearerUser, requestRole } from "../_shared/require-caller.ts";
import { authorizeRsvpConfirmation, escapeHtml } from "../_shared/notification-auth.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) => console.log(`[RSVP-CONFIRM] ${s}${d ? ` - ${JSON.stringify(d)}` : ''}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const event_id = typeof body.event_id === "string" ? body.event_id : "";
    const rsvp_id = typeof body.rsvp_id === "string" ? body.rsvp_id : "";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const role = requestRole(req);
    const callerId = role === "service_role" ? null : await getBearerUser(req.headers.get("Authorization"), admin);

    const { data: rsvp } = rsvp_id
      ? await admin
        .from("event_rsvps")
        .select("id, event_id, user_id, guest_email, guest_name, status, confirmation_sent_at, ticket_purchased")
        .eq("id", rsvp_id)
        .maybeSingle()
      : { data: null };

    const { data: eventOwner } = event_id
      ? await admin.from("events").select("creator_id").eq("id", event_id).maybeSingle()
      : { data: null };

    const access = authorizeRsvpConfirmation({
      callerId,
      role,
      eventId: event_id,
      rsvpId: rsvp_id,
      rsvp,
      eventCreatorId: eventOwner?.creator_id ?? null,
    });
    if (!access.ok || !rsvp) {
      return new Response(JSON.stringify({ error: access.ok ? "RSVP not found" : access.error }), {
        status: access.ok ? 400 : access.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rsvp.confirmation_sent_at) {
      log("Already sent");
      return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (rsvp.status !== "going" && rsvp.status !== "waitlist") {
      return new Response(JSON.stringify({ skipped: true, reason: rsvp.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: event } = await admin
      .from("events")
      .select("id, title, start_date, end_date, venue, address, city, state, image_url, description, timezone")
      .eq("id", event_id)
      .maybeSingle();

    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let email: string | null = null;
    let name = "there";
    if (rsvp.user_id) {
      const { data: profile } = await admin.from("profiles").select("display_name").eq("user_id", rsvp.user_id).maybeSingle();
      name = profile?.display_name || "there";
      const { data: u } = await admin.auth.admin.getUserById(rsvp.user_id);
      email = u?.user?.email || null;
    } else if (rsvp.guest_email) {
      email = rsvp.guest_email;
      name = rsvp.guest_name || "there";
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!email || !resendKey) {
      log("No email or no resend key", { email: !!email, key: !!resendKey });
      return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const start = new Date(event.start_date);
    const end = event.end_date ? new Date(event.end_date) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const dateStr = eventDateLabel(event.start_date, event.timezone);
    const timeStr = eventTimeLabel(event.start_date, event.timezone);
    const location = [event.venue, event.address, event.city, event.state].filter(Boolean).join(", ") || "Location TBA";
    const eventUrl = `https://etherbylcove.com/event/${event.id}`;
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(location)}`;

    const waitlisted = rsvp.status === "waitlist";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
        <h1 style="color: #1a1a2e; margin: 0 0 8px;">${waitlisted ? "You're on the waitlist" : "You're going!"}</h1>
        <p style="color: #555; margin: 0 0 20px;">Hey ${escapeHtml(name)}, ${waitlisted
          ? `the event is full. You're on the waitlist for <strong>${escapeHtml(event.title)}</strong>. We'll email you if a seat opens.`
          : `your RSVP for <strong>${escapeHtml(event.title)}</strong> is confirmed${rsvp.ticket_purchased ? " — ticket purchased." : "."}`}</p>
        ${event.image_url ? `<img src="${event.image_url}" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-bottom:16px" />` : ''}
        <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 16px 0;">
          <h2 style="margin: 0 0 12px; color: #1a1a2e; font-size: 20px;">${escapeHtml(event.title)}</h2>
          <p style="margin: 6px 0; color: #555;">📅 ${dateStr}</p>
          <p style="margin: 6px 0; color: #555;">🕐 ${timeStr}</p>
          <p style="margin: 6px 0; color: #555;">📍 ${location}</p>
        </div>
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr>
            <td style="padding-right: 8px;">
              <a href="${eventUrl}" style="display:inline-block;background:#e91e8c;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Event</a>
            </td>
            <td>
              <a href="${gcalUrl}" style="display:inline-block;background:#1a1a2e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Add to Calendar</a>
            </td>
          </tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px;">The host can email you about this event. — ETHER by lcove</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "notifications@etherbylcove.com",
        to: [email],
        subject: waitlisted ? `You're on the waitlist for ${event.title}` : `You're confirmed for ${event.title}`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      log("Resend failed", { status: res.status, body });
      return new Response(JSON.stringify({ error: "Email send failed", details: body }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("event_rsvps").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", rsvp_id);

    if (rsvp.user_id) {
      await admin.from("notifications").insert({
        user_id: rsvp.user_id,
        type: "event_confirmation",
        title: `RSVP confirmed: ${event.title}`,
        body: `${dateStr} · ${timeStr}`,
        data: { event_id: event.id },
      });
    }

    log("Sent", { email });
    return new Response(JSON.stringify({ success: true }), {
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
