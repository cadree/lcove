import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveHostIdentity } from "../_shared/host-email-identity.ts";
import { eventDateLabel, eventTimeLabel } from "../_shared/event-time.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-EVENT-REMINDER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { eventId, message, recipientUserIds, recipientRsvpIds } = await req.json();
    if (!eventId) throw new Error("Missing eventId");
    const userIdFilter: string[] | null = Array.isArray(recipientUserIds) && recipientUserIds.length > 0 ? recipientUserIds : null;
    const rsvpIdFilter: string[] | null = Array.isArray(recipientRsvpIds) && recipientRsvpIds.length > 0 ? recipientRsvpIds : null;

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, start_date, end_date, venue, city, creator_id, ticket_price, timezone")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");
    const { data: canManage } = await supabaseAdmin.rpc("can_manage_event", {
      p_event_id: eventId,
      p_user_id: user.id,
    });
    if (!canManage && event.creator_id !== user.id) throw new Error("Only the host can send reminders");

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

    const { data: attendeeRows } = (!userIdFilter && !rsvpIdFilter)
      ? await supabaseAdmin
        .from("event_attendees")
        .select("id, attendee_user_id, attendee_email, attendee_name, attendee_phone")
        .eq("event_id", eventId)
        .in("status", ["registered", "approved"])
      : { data: [] as Array<{ id: string; attendee_user_id: string | null; attendee_email: string | null; attendee_name: string | null; attendee_phone: string | null }> };

    type Recipient = {
      key: string;
      userId: string | null;
      email: string | null;
      name: string;
      phone: string | null;
    };
    const recipients: Recipient[] = [];
    const seen = new Set<string>();
    const addRecipient = (row: Recipient) => {
      const dedupe = (row.userId || row.email || row.key).toLowerCase();
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      recipients.push(row);
    };
    for (const rsvp of rsvps || []) {
      addRecipient({
        key: rsvp.id,
        userId: rsvp.user_id,
        email: rsvp.guest_email,
        name: rsvp.guest_name || "there",
        phone: rsvp.guest_phone,
      });
    }
    for (const attendee of attendeeRows || []) {
      addRecipient({
        key: attendee.id,
        userId: attendee.attendee_user_id,
        email: attendee.attendee_email,
        name: attendee.attendee_name || "there",
        phone: attendee.attendee_phone,
      });
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        sentCount: 0,
        failedCount: 0,
        message: "No guests to email.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventDate = eventDateLabel(event.start_date, event.timezone);
    const eventTime = eventTimeLabel(event.start_date, event.timezone);
    const eventPlace = event as unknown as { venue?: string | null; city?: string | null };
    const location = [eventPlace.venue, eventPlace.city].filter(Boolean).join(", ") || "Location TBA";
    const eventUrl = `https://etherbylcove.com/event/${eventId}`;
    const identity = await resolveHostIdentity(supabaseAdmin, eventId);

    let sentCount = 0;
    let failedCount = 0;
    let skippedNoEmail = 0;

    for (const recipient of recipients) {
      let email: string | null = recipient.email || null;
      let name = recipient.name || "there";

      if (recipient.userId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name")
          .eq("user_id", recipient.userId)
          .maybeSingle();
        name = profile?.display_name || name;

        if (!email) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(recipient.userId);
          email = userData?.user?.email || null;
        }
      }

      if (email) {
        try {
          const { data, error } = await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "event-reminder",
              recipientEmail: email,
              idempotencyKey: `reminder-${eventId}-${recipient.key}-${crypto.randomUUID()}`,
              from: "Ether <notifications@etherbylcove.com>",
              replyTo: identity.replyTo,
              templateData: {
                organizerName: identity.organizerName,
                recipientName: name,
                customMessage: message || null,
                signature: identity.signature,
                hostAvatarUrl: identity.hostAvatarUrl,
                headerImageUrl: identity.headerImageUrl,
                brandColor: identity.brandColor,
                eventTitle: event.title,
                eventDate,
                eventTime,
                location,
                eventUrl,
              },
            },
          });
          if (!error && data?.success !== false) {
            sentCount++;
            logStep("Email queued", { email });
          } else {
            failedCount++;
            logStep("Email failed", { email, error: error?.message || data?.reason });
          }
        } catch (err) {
          failedCount++;
          logStep("Email error", { email, error: String(err) });
        }
      } else {
        skippedNoEmail++;
      }
    }

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
    }

    await supabaseAdmin.from("event_reminder_log").insert({
      event_id: eventId,
      reminder_type: "custom",
      recipient_count: sentCount,
      message: message || null,
      sent_by: user.id,
    });

    const resultMessage = sentCount > 0
      ? `Queued email for ${sentCount} guest${sentCount === 1 ? "" : "s"}.`
      : skippedNoEmail > 0 && failedCount === 0
        ? "No guests have an email address."
        : failedCount > 0
          ? `Could not queue email for ${failedCount} guest${failedCount === 1 ? "" : "s"}.`
          : "No guests to email.";

    logStep("Complete", { emailsQueued: sentCount, failedCount, skippedNoEmail, pushSent: pushSentCount });

    return new Response(
      JSON.stringify({
        success: sentCount > 0 || failedCount === 0,
        sentCount,
        failedCount,
        skippedNoEmail,
        pushSentCount,
        message: resultMessage,
        totalAttendees: recipients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(error),
    });
  }
});
