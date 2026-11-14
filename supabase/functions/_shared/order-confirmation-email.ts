import { eventDateLabel, eventTimeLabel } from "./event-time.mjs";
import { resolveHostIdentity } from "./host-email-identity.ts";
import { guestEventEmailHtml } from "./guest-event-email.mjs";
import { unsubscribeLink } from "./unsubscribe-link.mjs";
import { appleWalletConfigured, appleWalletEnv } from "./wallet-config.mjs";
import { smsProviderFromDeno, sendSms } from "./sms-provider.mjs";
import { formatUsd } from "./ticket-fees.mjs";

function smsEnv() {
  return {
    SMS_PROVIDER: Deno.env.get("SMS_PROVIDER") || "",
    TWILIO_ACCOUNT_SID: Deno.env.get("TWILIO_ACCOUNT_SID") || "",
    TWILIO_AUTH_TOKEN: Deno.env.get("TWILIO_AUTH_TOKEN") || "",
    TWILIO_PHONE_NUMBER: Deno.env.get("TWILIO_PHONE_NUMBER") || "",
  };
}

async function qrDataUrl(value: string): Promise<string | null> {
  try {
    const imported = await import("npm:qrcode@1.5.4");
    const QRCode = imported.default || imported;
    return await QRCode.toDataURL(value, { margin: 1, width: 360 });
  } catch (error) {
    console.error("[order-email] qr skipped", error);
    return null;
  }
}

export async function sendOrderConfirmation(admin, orderId: string): Promise<{ sent: boolean; reason?: string }> {
  const { data: order } = await admin.from("ticket_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order?.purchaser_email) return { sent: false, reason: "no_email" };
  const notes = typeof order.notes === "string" ? order.notes : "";
  if (notes.includes("confirmation_sent")) return { sent: false, reason: "already_sent" };

  const { data: claimed } = await admin
    .from("ticket_orders")
    .update({ notes: notes ? `${notes}|confirmation_sent` : "confirmation_sent" })
    .eq("id", orderId)
    .or(notes ? `notes.eq.${notes}` : "notes.is.null")
    .select("id");
  if (!claimed?.length) return { sent: false, reason: "already_sent" };

  const unsub = await unsubscribeLink(admin, order.purchaser_email);
  if (unsub.suppressed) return { sent: false, reason: "unsubscribed" };

  const { data: event } = await admin
    .from("events")
    .select("id, title, start_date, end_date, venue, address, city, state, image_url, timezone, hide_address")
    .eq("id", order.event_id)
    .maybeSingle();
  if (!event) return { sent: false, reason: "no_event" };

  const { data: attendees } = await admin
    .from("event_attendees")
    .select("qr_code, ticket_number, attendee_name, tier_id")
    .eq("order_id", orderId);
  const tierIds = [...new Set((attendees || []).map((row) => row.tier_id).filter(Boolean))];
  const { data: tiers } = tierIds.length
    ? await admin.from("ticket_tiers").select("id, name, price_cents").in("id", tierIds)
    : { data: [] };
  const tierName = new Map((tiers || []).map((tier) => [tier.id, tier.name]));

  const identity = await resolveHostIdentity(admin, event.id);
  const secret = await admin.from("event_secrets").select("private_address, host_notes").eq("event_id", event.id).maybeSingle();
  const street = event.hide_address ? secret.data?.private_address : event.address;
  const location = [event.venue, street, event.city, event.state].filter(Boolean).join(", ") || "Location TBA";
  const hostNotes = typeof secret.data?.host_notes === "string" ? secret.data.host_notes : "";
  const { data: namedGuests } = await admin
    .from("event_attendees")
    .select("attendee_name")
    .eq("event_id", event.id)
    .in("status", ["registered", "approved", "checked_in"])
    .limit(8);
  const guestNames = (namedGuests || []).map((person) => person.attendee_name).filter((person) => !!person);
  const eventUrl = `https://etherbylcove.com/event/${event.id}/confirmation?order_id=${orderId}`;
  const qrValue = attendees?.[0]?.qr_code || orderId;
  const qr = await qrDataUrl(qrValue);
  const lines = (attendees || []).map((row) => ({
    tier: tierName.get(row.tier_id) || "Ticket",
    price: formatUsd(Math.round((order.total_cents || 0) / Math.max(order.quantity || 1, 1))),
  }));
  const html = guestEventEmailHtml({
    hostName: identity.hostDisplayName,
    hostAvatarUrl: identity.hostAvatarUrl,
    flyerUrl: identity.headerImageUrl || event.image_url,
    brandColor: identity.brandColor,
    eventTitle: event.title,
    eventDate: eventDateLabel(event.start_date, event.timezone),
    eventTime: eventTimeLabel(event.start_date, event.timezone),
    location,
    hostNotes,
    guestNames,
    mapUrl: `https://maps.google.com/?q=${encodeURIComponent(location)}`,
    intro: "You're in.",
    order: {
      number: attendees?.[0]?.ticket_number || orderId.slice(0, 8),
      name: order.purchaser_name || "Guest",
      lines: lines.length ? lines : [{ tier: "Ticket", price: formatUsd(order.total_cents || 0) }],
      total: (order.total_cents || 0) === 0 ? "Free" : formatUsd(order.total_cents || 0),
    },
    qrSrc: qr,
    walletUrl: appleWalletConfigured(appleWalletEnv()) ? eventUrl : null,
    eventUrl,
    unsubscribeUrl: unsub.url,
  });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const payload: Record<string, unknown> = {
      from: identity.fromHeader,
      to: [order.purchaser_email],
      subject: `You're in for ${event.title}`,
      html,
    };
    if (identity.replyTo) payload.reply_to = identity.replyTo;
    if (qr?.startsWith("data:image/png;base64,")) {
      payload.attachments = [{
        filename: "ticket.png",
        content: qr.slice("data:image/png;base64,".length),
        content_id: "ticket-qr",
      }];
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[order-email] resend failed", res.status);
    }
  }

  const optedIn = notes.includes("marketing_opt_in");
  const phone = order.purchaser_phone;
  if (optedIn && phone && smsProviderFromDeno().enabled) {
    await sendSms(smsEnv(), {
      to: phone,
      body: `You're in for ${event.title}. ${eventUrl}`,
    }).catch((error) => console.error("[order-email] sms skipped", error));
  }

  return { sent: Boolean(resendKey) };
}
