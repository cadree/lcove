import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { eventDateLabel, eventTimeLabel } from "../_shared/event-time.mjs";
import { getBearerUser, requestRole } from "../_shared/require-caller.ts";
import { authorizeRsvpConfirmation, escapeHtml } from "../_shared/notification-auth.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";
import { resolveHostIdentity } from "../_shared/host-email-identity.ts";
import { guestEventEmailHtml } from "../_shared/guest-event-email.mjs";
import { unsubscribeLink } from "../_shared/unsubscribe-link.mjs";

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

    const dateStr = eventDateLabel(event.start_date, event.timezone);
    const timeStr = eventTimeLabel(event.start_date, event.timezone);
    const location = [event.venue, event.address, event.city, event.state].filter(Boolean).join(", ") || "Location TBA";
    const eventUrl = `https://etherbylcove.com/event/${event.id}`;
    const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(location)}`;
    const identity = await resolveHostIdentity(admin, event_id);
    const unsub = await unsubscribeLink(admin, email);
    if (unsub.suppressed) {
      log("Unsubscribed");
      return new Response(JSON.stringify({ skipped: true, reason: "unsubscribed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const waitlisted = rsvp.status === "waitlist";
    const intro = waitlisted
      ? `Hey ${escapeHtml(name)}, the event is full. You're on the waitlist. We'll email you if a seat opens.`
      : `Hey ${escapeHtml(name)}, you're in.`;
    const html = guestEventEmailHtml({
      hostName: identity.hostDisplayName,
      hostAvatarUrl: identity.hostAvatarUrl,
      flyerUrl: identity.headerImageUrl,
      brandColor: identity.brandColor,
      eventTitle: event.title,
      eventDate: dateStr,
      eventTime: timeStr,
      location,
      mapUrl,
      intro,
      eventUrl,
      unsubscribeUrl: unsub.url,
    });

    const payload: Record<string, unknown> = {
      from: identity.fromHeader,
      to: [email],
      subject: waitlisted ? `You're on the waitlist for ${event.title}` : `You're in for ${event.title}`,
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
