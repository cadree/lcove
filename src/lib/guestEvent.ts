export interface EventDraftInput {
  title: string;
  start: string;
  end: string;
  venue: string;
  summary: string;
  address: string;
  price: string;
  capacity: string;
  mode: "tickets" | "rsvp";
}

export function validateEventDraft(draft: EventDraftInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = "Add a title.";
  if (!draft.start) errors.start = "Add a start time.";
  if (!draft.end) errors.end = "Add an end time.";
  if (draft.start && draft.end && new Date(draft.end).getTime() <= new Date(draft.start).getTime()) {
    errors.end = "End must be after the start.";
  }
  if (!draft.venue.trim()) errors.venue = "Add a venue name.";
  if (draft.mode === "tickets") {
    const price = Number(draft.price);
    if (!draft.price.trim() || !Number.isFinite(price) || price < 0) {
      errors.price = "Add a ticket price, or choose RSVP only.";
    }
  }
  if (draft.capacity.trim()) {
    const capacity = Number(draft.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "Capacity must be a whole number.";
  }
  return errors;
}

export function guestlistLine(names: string[], total: number): string {
  const first = names.map((name) => name.trim()).filter(Boolean);
  if (total <= 0) return "Be the first to go";
  if (first.length === 0) return "RSVP to see who's going";
  if (total === 1) return `${first[0]} is going`;
  const others = Math.max(total - 1, 1);
  return `${first[0]} and ${others} ${others === 1 ? "other" : "others"} going`;
}

export function goingCountLabel(total: number): string {
  if (total <= 0) return "0 going";
  if (total > 99) return "99+ going";
  return `${total}+ going`;
}

export function stickyCtaLabel(buyerCents: number | null, rsvpOnly: boolean): string {
  if (rsvpOnly || buyerCents === 0) return "RSVP";
  if (buyerCents == null) return "Sold out";
  return `Buy tickets from $${(buyerCents / 100).toFixed(2)}`;
}

function placePart(value?: string | null): string {
  const text = (value || "").trim();
  if (!text || text.toUpperCase() === "TBA") return "";
  return text;
}

/** City and state only. The street stays off this label. */
export function generalAreaLabel(city?: string | null, state?: string | null): string | null {
  const parts = [placePart(city), placePart(state)].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** A free event has no paid ticket type and no paid tier. */
export function eventIsFree(ticketType: string | null | undefined, paidTier: boolean): boolean {
  if (paidTier) return false;
  if (ticketType === "paid" || ticketType === "credits" || ticketType === "hybrid" || ticketType === "info") return false;
  return true;
}

export function publicTicketBadge(input: {
  ticketType?: string | null;
  free: boolean;
  fromCents: number | null;
  creditsPrice?: number | null;
}): string {
  if (input.ticketType === "credits") {
    return input.creditsPrice ? `${input.creditsPrice} Credits` : "Credits";
  }
  if (input.ticketType === "info") return "Info only";
  if (input.free) return "Free Event";
  if (input.fromCents && input.fromCents > 0) {
    return `Tickets from $${(input.fromCents / 100).toFixed(2)}`;
  }
  return "Tickets";
}

export interface TicketLine {
  tierId: string;
  quantity: number;
}

export function normalizeTicketLines(lines: TicketLine[]): TicketLine[] {
  return lines
    .map((line) => ({ tierId: line.tierId, quantity: Math.max(0, Math.floor(line.quantity || 0)) }))
    .filter((line) => line.tierId && line.quantity > 0);
}

const selectionKey = (eventId: string) => `ether-ticket-lines:${eventId}`;

export function saveTicketLines(eventId: string, lines: TicketLine[]): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(selectionKey(eventId), JSON.stringify(normalizeTicketLines(lines)));
}

export function readTicketLines(eventId: string): TicketLine[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(selectionKey(eventId)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return normalizeTicketLines(parsed.filter((line) => line && typeof line.tierId === "string"));
  } catch {
    return [];
  }
}

export const FLYER_FONTS = [
  { id: "cinzel", label: "Cinzel", family: '"Cinzel", Georgia, serif' },
  { id: "fraunces", label: "Fraunces", family: '"Fraunces", Georgia, serif' },
  { id: "cormorant", label: "Cormorant", family: '"Cormorant Garamond", Georgia, serif' },
  { id: "dm-sans", label: "DM Sans", family: '"DM Sans", sans-serif' },
] as const;

export function flyerFontFamily(id: string | null | undefined): string {
  return FLYER_FONTS.find((font) => font.id === id)?.family || FLYER_FONTS[0].family;
}
