// Pure decisions shared by the event page and the database trigger.
// The trigger in supabase/migrations/20261023150000_event_guest_list.sql is the lock.

export interface PaidSeat {
  id: string;
  orderId: string | null;
  userId: string | null;
  email: string | null;
  status: string;
  rsvpId: string | null;
}

// Mirrors sync_rsvp_attendee when ticket_purchased is set. The order row keeps
// the seat. RSVP-only rows for the same person are cancelled.
export function paidConfirmSeats(input: {
  rsvpId: string;
  userId: string | null;
  email: string | null;
  seats: PaidSeat[];
}): { linkedId: string | null; cancelledIds: string[]; registeredIds: string[] } {
  const email = input.email?.trim().toLowerCase() || null;
  const samePerson = (seat: PaidSeat) =>
    (input.userId != null && seat.userId === input.userId)
    || (email != null && seat.email?.trim().toLowerCase() === email);
  const orderCandidates = input.seats.filter((seat) => seat.orderId != null && samePerson(seat));
  const orderRow = orderCandidates.find((seat) => seat.status === "registered" || seat.status === "approved")
    ?? orderCandidates[0];
  if (!orderRow) {
    return {
      linkedId: null,
      cancelledIds: [],
      registeredIds: input.seats
        .filter((seat) => seat.status === "registered" || seat.status === "approved")
        .map((seat) => seat.id),
    };
  }
  const cancelledIds = input.seats
    .filter((seat) =>
      seat.id !== orderRow.id
      && seat.orderId == null
      && seat.status !== "cancelled"
      && (seat.rsvpId === input.rsvpId || samePerson(seat))
    )
    .map((seat) => seat.id);
  const registeredIds = input.seats
    .filter((seat) =>
      !cancelledIds.includes(seat.id)
      && (seat.status === "registered" || seat.status === "approved" || seat.id === orderRow.id)
    )
    .map((seat) => seat.id);
  return { linkedId: orderRow.id, cancelledIds, registeredIds };
}

// Stripe Checkout sessions last at most 24 hours. Older pending orders are
// abandoned even if the expired webhook never arrived.
export function isAbandonedPendingOrder(createdAt: string, now: Date, hours = 24): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return created < now.getTime() - hours * 60 * 60 * 1000;
}

export function decideRsvpStatus(input: {
  requested: string;
  capacity: number | null;
  seatsTakenExcludingSelf: number;
  alreadyGoing: boolean;
  ticketPurchased: boolean;
}): string {
  if (input.requested !== "going") return input.requested;
  if (input.ticketPurchased || input.alreadyGoing) return "going";
  if (input.capacity == null) return "going";
  if (input.seatsTakenExcludingSelf >= input.capacity) return "waitlist";
  return "going";
}

export function attendanceSummary(capacity: number | null | undefined, going: number) {
  const cap = capacity == null ? null : capacity;
  const soldOut = cap != null && going >= cap;
  const spotsLeft = cap == null ? null : Math.max(0, cap - going);
  const overCapacity = cap != null && going > cap;
  return { soldOut, spotsLeft, overCapacity };
}

export function attendanceLabel(capacity: number | null | undefined, going: number): string {
  const { soldOut, spotsLeft, overCapacity } = attendanceSummary(capacity, going);
  const people = `${going} attending`;
  if (overCapacity && capacity != null) return `${people} · capacity ${capacity} · sold out`;
  if (soldOut) return `${people} · sold out`;
  if (spotsLeft != null) return `${people} · ${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`;
  return people;
}

export function parseGuestRsvp(data: unknown): { id: string | null; status: "going" | "waitlist" } {
  if (typeof data === "string" && data.length > 0) return { id: data, status: "going" };
  if (data && typeof data === "object") {
    const row = data as { id?: unknown; status?: unknown };
    const id = typeof row.id === "string" ? row.id : null;
    return { id, status: row.status === "waitlist" ? "waitlist" : "going" };
  }
  return { id: null, status: "going" };
}

export interface CampaignTotals {
  people?: number;
  sent?: number;
  email_sent?: number;
  email_delivered?: number;
  opened?: number;
  clicked?: number;
  failed?: number;
  opens_tracked?: boolean;
  clicks_tracked?: boolean;
  delivery_tracked?: boolean;
  rsvped?: number;
  by_channel?: Record<string, number>;
}

export function campaignPerformance(totals: CampaignTotals) {
  const channel = totals.by_channel ?? {};
  const channelLine = Object.entries(channel)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name.replace("_", "-")}`)
    .join(", ");
  return {
    people: totals.people ?? 0,
    emails: totals.email_sent ?? 0,
    opened: totals.opens_tracked ? String(totals.opened ?? 0) : "Not tracked",
    clicked: totals.clicks_tracked ? String(totals.clicked ?? 0) : "Not tracked",
    delivered: totals.delivery_tracked ? String(totals.email_delivered ?? 0) : "Not tracked",
    rsvped: totals.rsvped ?? 0,
    failed: totals.failed ?? 0,
    logged: totals.sent ?? 0,
    channelLine,
  };
}

export function recentCampaignLabel(recipientCount?: number, sentCount?: number): string {
  const people = recipientCount ?? 0;
  const sends = sentCount ?? 0;
  const personWord = people === 1 ? "person" : "people";
  const sendWord = sends === 1 ? "channel send" : "channel sends";
  return `${people} ${personWord} · ${sends} ${sendWord}`;
}

export function calendarSubscribeLinks(feedUrl: string) {
  const httpsUrl = feedUrl.replace(/^webcal:\/\//i, "https://");
  const webcalUrl = httpsUrl.replace(/^https:\/\//i, "webcal://");
  return {
    feed: httpsUrl,
    webcal: webcalUrl,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(httpsUrl)}`,
    apple: webcalUrl,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent("Ether events")}`,
  };
}

export function icsUtcStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("bad date");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const ETHER_HOSTS = new Set(["etherbylcove.com", "localhost", "127.0.0.1"]);

export function safeTrackDestination(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowed = ETHER_HOSTS.has(host) || host.endsWith(".etherbylcove.com");
    if ((url.protocol === "https:" || url.protocol === "http:") && allowed) return url.toString();
  } catch {
    return fallback;
  }
  return fallback;
}
