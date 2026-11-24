/** "Open to" tags on a profile: a short preset list and an optional end date. */
export const OPEN_TO = [
  { id: "shoots", label: "Shoots" },
  { id: "features", label: "Features" },
  { id: "paid_gigs", label: "Paid gigs" },
  { id: "collabs", label: "Collabs" },
  { id: "mentoring", label: "Mentoring" },
  { id: "studio_sessions", label: "Studio sessions" },
  { id: "events", label: "Events" },
  { id: "travel_work", label: "Travel work" },
] as const;

export type OpenToTag = (typeof OPEN_TO)[number]["id"];

export interface OpenToRow {
  user_id: string;
  tags: string[];
  until: string | null;
  updated_at: string;
}

/** Tags with no end date stop showing this many days after the last save. */
export const OPEN_TO_DEFAULT_DAYS = 90;
/** The furthest end date someone can pick. */
export const OPEN_TO_MAX_DAYS = 180;

const KNOWN = new Map<string, string>(OPEN_TO.map((t) => [t.id, t.label]));

export function openToLabel(tag: string): string | null {
  return KNOWN.get(tag) ?? null;
}

/** Known tags only, in the preset order. */
export function cleanOpenTo(tags: Iterable<string>): OpenToTag[] {
  const picked = new Set(tags);
  return OPEN_TO.filter((t) => picked.has(t.id)).map((t) => t.id);
}

/** A UTC calendar date (YYYY-MM-DD), the same day boundary the server uses. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDay(d);
}

/** The last day the tags show. */
export function openToLastDay(row: Pick<OpenToRow, "until" | "updated_at">): string {
  return row.until || addDays(utcDay(new Date(row.updated_at)), OPEN_TO_DEFAULT_DAYS);
}

export function openToActive(row: Pick<OpenToRow, "until" | "updated_at" | "tags"> | null | undefined, now = new Date()): boolean {
  return !!row && row.tags.length > 0 && openToLastDay(row) >= utcDay(now);
}

/** Current tags for display, or none once they have expired. */
export function currentOpenTo(row: OpenToRow | null | undefined, now = new Date()): OpenToTag[] {
  return openToActive(row, now) ? cleanOpenTo(row!.tags) : [];
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Until Dec 4" when the person set a date; nothing for the 90-day default. */
export function openToUntilLabel(row: Pick<OpenToRow, "until"> | null | undefined): string | null {
  return row?.until ? `Until ${SHORT.format(new Date(`${row.until.slice(0, 10)}T00:00:00Z`))}` : null;
}

/** Why an end date can't be saved, or null when it can. */
export function openToUntilError(until: string | null, now = new Date()): string | null {
  if (!until) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return "Pick a date";
  const today = utcDay(now);
  if (until < today) return "Pick today or a later date";
  if (until > addDays(today, OPEN_TO_MAX_DAYS)) return "Pick a date within 6 months";
  return null;
}

/** People filter: everyone who is open to every picked tag. */
export function hasOpenTo(personTags: readonly string[] | undefined, wanted: readonly string[]): boolean {
  if (!wanted.length) return true;
  const mine = new Set(personTags || []);
  return wanted.every((tag) => mine.has(tag));
}

/** Open-to tags of each person, keyed by user id, with expired rows left out. */
export function openToByUser(rows: OpenToRow[], now = new Date()): Map<string, OpenToTag[]> {
  const out = new Map<string, OpenToTag[]>();
  for (const row of rows) {
    const tags = currentOpenTo(row, now);
    if (tags.length) out.set(row.user_id, tags);
  }
  return out;
}
