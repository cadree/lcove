/** Human dates for trips. Trip dates are calendar days (YYYY-MM-DD), so they format in UTC to never shift a day. */
const parse = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
const MONTH_DAY = fmt({ month: "short", day: "numeric" });
const DAY = fmt({ day: "numeric" });
const FULL = fmt({ month: "short", day: "numeric", year: "numeric" });

/** "May 1–6, 2099", "Apr 28–May 3, 2099", "Dec 30, 2099–Jan 2, 2100"; raw text if unparseable. */
export function tripRange(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  if (!a || !b) return [start, end].filter(Boolean).join(" – ");
  const year = b.getUTCFullYear();
  if (a.getUTCFullYear() !== year) return `${FULL.format(a)}–${FULL.format(b)}`;
  if (a.getTime() === b.getTime()) return FULL.format(a);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  return `${MONTH_DAY.format(a)}–${sameMonth ? DAY.format(b) : MONTH_DAY.format(b)}, ${year}`;
}

const STATUS: Record<string, string> = { planning: "Planning", booked: "Booked", completed: "Completed", cancelled: "Cancelled" };
export const tripStatus = (status: string) => STATUS[status] ?? status;

/** Today as YYYY-MM-DD in the viewer's own calendar. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Problems with a new trip's dates before they reach the server, or null. */
export function tripDatesError(start: string, end: string, today = todayIso()): string | null {
  if (!parse(start) || !parse(end)) return "Choose arrival and departure dates.";
  if (start < today) return "Arrival can't be in the past.";
  if (end < start) return "Departure must be on or after arrival.";
  return null;
}

/** The organizer can close out a booked trip once its last day has arrived (matches the server rule). */
export const canComplete = (trip: { status: string; ends_on: string }, today = todayIso()) =>
  trip.status === "booked" && trip.ends_on <= today;
