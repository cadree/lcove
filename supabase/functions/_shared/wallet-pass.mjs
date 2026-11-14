/**
 * Apple Wallet event tickets.
 * The request may name a ticket or an order. Title, venue, guest, and QR
 * come from the rows passed in, which the function loaded from the database.
 */

import { eventDateLabel, eventTimeLabel } from "./event-time.mjs";
import { buildPkpass, passImages } from "./pkpass.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIVE_STATUSES = new Set(["registered", "approved", "confirmed", "checked_in"]);

const NOT_OWNED = "You don't own this ticket";
const NOT_ISSUABLE = "This ticket cannot be added to Wallet";

function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

function sameId(left, right) {
  return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase();
}

function passText(value, fallback, max = 80) {
  const flat = String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  return flat.length > max ? flat.slice(0, max) : flat;
}

function deny(status, error) {
  return { ok: false, status, error };
}

export function parseWalletPassBody(body) {
  if (body && body.probe === true) return { probe: true };
  const ticketId = firstUuid(body, ["ticketId", "ticket_id", "attendeeId", "attendee_id"]);
  const orderId = firstUuid(body, ["orderId", "order_id"]);
  if (ticketId === false || orderId === false) {
    return { error: "A ticket or order id is required" };
  }
  if (!ticketId && !orderId) return { error: "A ticket or order id is required" };
  return { ticketId: ticketId || null, orderId: orderId || null };
}

function firstUuid(body, keys) {
  if (!body || typeof body !== "object") return null;
  for (const key of keys) {
    if (!(key in body) || body[key] == null || body[key] === "") continue;
    if (typeof body[key] !== "string" || !isUuid(body[key])) return false;
    return body[key];
  }
  return null;
}

export function ticketVenue(event) {
  if (!event) return "Venue";
  const street = event.hide_address ? event.private_address : event.address;
  const parts = [event.venue, street, event.city, event.state];
  return passText(parts.filter(Boolean).join(", "), "Venue", 120);
}

export function ticketGuestName(attendee) {
  return passText(attendee?.attendee_name, "Guest");
}

export function ticketHostName(name) {
  return passText(name, "Host");
}

export function ticketFilename(title) {
  const slug = passText(title, "ticket", 40).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "ticket"}.pkpass`;
}

export function callerOwnsTicket({ callerId, attendee, order, rsvp }) {
  if (!callerId || !attendee) return false;
  if (sameId(attendee.attendee_user_id, callerId)) return true;
  if (
    order
    && sameId(order.id, attendee.order_id)
    && sameId(order.purchaser_user_id, callerId)
    && sameId(order.event_id, attendee.event_id)
  ) {
    return true;
  }
  if (
    rsvp
    && sameId(rsvp.id, attendee.rsvp_id)
    && sameId(rsvp.user_id, callerId)
    && sameId(rsvp.event_id, attendee.event_id)
  ) {
    return true;
  }
  return false;
}

export function ticketIsIssuable(attendee, order) {
  if (!attendee || typeof attendee.qr_code !== "string" || !attendee.qr_code.trim()) return false;
  if (!ACTIVE_STATUSES.has(attendee.status)) return false;
  if (attendee.order_id) {
    if (!order || !sameId(order.id, attendee.order_id)) return false;
    if (order.payment_status !== "paid") return false;
  }
  return true;
}

function findById(rows, id) {
  if (!id) return null;
  return (rows || []).find((row) => sameId(row.id, id)) ?? null;
}

function byCreated(left, right) {
  const a = String(left.created_at || "");
  const b = String(right.created_at || "");
  if (a !== b) return a < b ? -1 : 1;
  return String(left.id).localeCompare(String(right.id));
}

function linkedOrder(attendee, orders) {
  if (!attendee?.order_id) return null;
  return findById(orders, attendee.order_id);
}

function linkedRsvp(attendee, rsvps) {
  if (!attendee?.rsvp_id) return null;
  return findById(rsvps, attendee.rsvp_id);
}

function pickOwnedAttendee(callerId, attendees, orders, rsvps) {
  const owned = attendees.filter((attendee) => callerOwnsTicket({
    callerId,
    attendee,
    order: linkedOrder(attendee, orders),
    rsvp: linkedRsvp(attendee, rsvps),
  }));
  const issuable = owned.filter((attendee) => ticketIsIssuable(attendee, linkedOrder(attendee, orders)));
  issuable.sort(byCreated);
  return issuable.find((attendee) => sameId(attendee.attendee_user_id, callerId)) || issuable[0] || null;
}

/**
 * Decide whether this signed-in member may have a pass, and which database
 * ticket it is. Request display fields are not accepted here.
 */
export function resolveWalletTicket({ callerId, ticketId, orderId, rows }) {
  if (!callerId) return deny(401, "Unauthorized");
  if ((ticketId && !isUuid(ticketId)) || (orderId && !isUuid(orderId)) || (!ticketId && !orderId)) {
    return deny(400, "A ticket or order id is required");
  }

  const attendees = rows?.attendees || [];
  const orders = rows?.orders || [];
  const rsvps = rows?.rsvps || [];
  const events = rows?.events || [];

  let attendee = null;
  if (ticketId) {
    attendee = findById(attendees, ticketId);
    if (orderId && attendee && !sameId(attendee.order_id, orderId)) return deny(403, NOT_OWNED);
    if (!attendee) return deny(403, NOT_OWNED);
  } else {
    const onOrder = attendees.filter((row) => sameId(row.order_id, orderId));
    attendee = pickOwnedAttendee(callerId, onOrder, orders, rsvps);
    if (!attendee) return deny(403, NOT_OWNED);
  }

  const order = linkedOrder(attendee, orders);
  const rsvp = linkedRsvp(attendee, rsvps);
  if (attendee.order_id && !order) return deny(403, NOT_OWNED);
  if (!callerOwnsTicket({ callerId, attendee, order, rsvp })) return deny(403, NOT_OWNED);
  if (!ticketIsIssuable(attendee, order)) return deny(403, NOT_ISSUABLE);

  const event = findById(events, attendee.event_id);
  if (!event?.title || !event.start_date) return deny(403, NOT_OWNED);
  const host = (rows?.hosts || []).find((row) => sameId(row.user_id, event.creator_id));

  return {
    ok: true,
    attendee,
    order,
    rsvp,
    event,
    hostName: ticketHostName(host?.display_name),
    venue: ticketVenue(event),
    guestName: ticketGuestName(attendee),
  };
}

export function eventTicketPassJson(resolved, meta) {
  const { event, attendee, hostName, venue, guestName } = resolved;
  const dateLabel = eventDateLabel(event.start_date, event.timezone);
  const timeLabel = eventTimeLabel(event.start_date, event.timezone);
  const qr = attendee.qr_code;
  const barcode = {
    message: qr,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: passText(attendee.ticket_number, "Ticket", 40),
  };
  return {
    formatVersion: 1,
    passTypeIdentifier: meta.passTypeIdentifier,
    serialNumber: attendee.id,
    teamIdentifier: meta.teamIdentifier,
    organizationName: hostName,
    description: passText(event.title, "Event", 120),
    logoText: hostName,
    foregroundColor: "rgb(255, 248, 252)",
    backgroundColor: "rgb(24, 16, 22)",
    labelColor: "rgb(255, 159, 200)",
    eventTicket: {
      headerFields: [{ key: "when", label: "WHEN", value: dateLabel }],
      primaryFields: [{ key: "event", label: hostName, value: passText(event.title, "Event", 120) }],
      secondaryFields: [
        { key: "venue", label: "VENUE", value: venue },
        { key: "guest", label: "GUEST", value: guestName },
      ],
      auxiliaryFields: timeLabel ? [{ key: "time", label: "TIME", value: timeLabel }] : [],
      backFields: [{ key: "powered", label: "TICKET", value: "Powered by Ether" }],
    },
    barcode,
    barcodes: [barcode],
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

/**
 * Sign a pass for a ticket the caller owns. `rows` are database records.
 * Display fields on `body` are ignored.
 */
export async function issueWalletPass({
  callerId,
  body,
  rows,
  configured,
  certs,
  passTypeIdentifier,
  teamIdentifier,
}) {
  const parsed = parseWalletPassBody(body);
  if (parsed.probe) return { status: 200, body: { configured: configured === true } };
  if (configured !== true) return { status: 200, body: { configured: false } };
  if (parsed.error) return { status: 400, body: { error: parsed.error } };

  const resolved = resolveWalletTicket({
    callerId,
    ticketId: parsed.ticketId,
    orderId: parsed.orderId,
    rows,
  });
  if (!resolved.ok) return { status: resolved.status, body: { error: resolved.error } };

  const pass = eventTicketPassJson(resolved, { passTypeIdentifier, teamIdentifier });
  const bytes = await buildPkpass(
    [
      { name: "pass.json", data: JSON.stringify(pass) },
      ...passImages(),
    ],
    certs,
  );
  return {
    status: 200,
    bytes,
    body: {
      configured: true,
      platform: "apple",
      filename: ticketFilename(resolved.event.title),
      pkpass: bytesToBase64(bytes),
    },
  };
}
