// Guest consumer checks shared by RSVP, store checkout, and live watch.
// Rate-limit keys are hashes. Raw IP addresses are not stored.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GUEST_LIMITS = {
  rsvpEmailPerDay: 8,
  rsvpIpPerHour: 30,
  rsvpGlobalPerHour: 400,
  checkoutEmailPerHour: 6,
  checkoutIpPerHour: 20,
  checkoutGlobalPerHour: 200,
  ticketEmailPerHour: 6,
  ticketIpPerHour: 20,
  liveIpPerHour: 60,
};

export function normalizeGuestName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 100) return "";
  return name;
}

export function normalizeGuestEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 255 || !EMAIL.test(email)) return "";
  return email;
}

export function parseGuestCheckout(body) {
  const record = body && typeof body === "object" ? body : {};
  const name = normalizeGuestName(record.guestName);
  const email = normalizeGuestEmail(record.guestEmail);
  const quantity = Number(record.quantity ?? 1);
  if (!name || !email) return null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return null;
  if (record.paymentType && record.paymentType !== "cash") return null;
  return { name, email, quantity };
}

export function watchableStream(stream) {
  if (!stream || typeof stream !== "object") return false;
  if (stream.is_live === true) return true;
  if (stream.replay_available === true && typeof stream.replay_url === "string" && stream.replay_url.trim()) {
    return true;
  }
  if (stream.started_at) return true;
  const type = stream.stream_type;
  const external = typeof stream.external_url === "string" ? stream.external_url.trim() : "";
  return (type === "youtube" || type === "twitch" || type === "soundcloud") && external.length > 0;
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return typeof direct === "string" ? direct : "";
}

export async function clientRateKey(headers) {
  const forwarded = headerValue(headers, "x-forwarded-for");
  const ip = (
    headerValue(headers, "cf-connecting-ip")
    || headerValue(headers, "x-real-ip")
    || (forwarded ? forwarded.split(",")[0] : "")
  ).trim();
  if (!ip) return "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ether-guest:${ip}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
