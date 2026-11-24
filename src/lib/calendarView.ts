/** Pure calendar layout and filter rules, shared by the month grid, agenda and filters. */
export type CalendarViewType = "month" | "week" | "agenda";

export interface CalendarEntry {
  id: string;
  type: "event" | "project" | "personal";
  start_date: string;
  city?: string;
  data: unknown;
}

/** A month as full weeks: leading and trailing blanks are explicit so no row is left half-drawn. */
export function monthCells(anchor: Date): (Date | null)[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** What a day cell shows: up to `cap` items, the rest as "+N more". */
export function dayPreview<T>(items: T[], cap = 2): { shown: T[]; more: number } {
  return { shown: items.slice(0, cap), more: Math.max(0, items.length - cap) };
}

/** Phones open on the agenda (readable); wider screens open on the month grid. */
export function initialCalendarView(width: number): CalendarViewType {
  return width < 640 ? "agenda" : "month";
}

export const ALL_CITIES = "All Cities";

/** City choices from the events actually on the calendar, busiest first. */
export function cityOptions(items: CalendarEntry[]): { city: string; count: number }[] {
  const counts = new Map<string, { city: string; count: number }>();
  for (const item of items) {
    if (item.type !== "event") continue;
    const city = item.city?.trim();
    if (!city) continue;
    const key = city.toLowerCase();
    const entry = counts.get(key) || { city, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

const creatorOf = (item: CalendarEntry) => (item.data as { creator_id?: string } | null)?.creator_id;

/**
 * City narrows events only (projects and your reminders have no city).
 * "Connections" keeps events hosted by you or people you've matched with, plus your own items.
 */
export function filterCalendar<T extends CalendarEntry>(
  items: T[],
  { city, connectionsOnly, connections, me }: { city: string; connectionsOnly: boolean; connections: Set<string>; me?: string }
): T[] {
  const wanted = city && city !== ALL_CITIES ? city.trim().toLowerCase() : null;
  return items.filter((item) => {
    if (item.type !== "event") return item.type === "personal" || !connectionsOnly || creatorOf(item) === me;
    if (wanted && item.city?.trim().toLowerCase() !== wanted) return false;
    if (!connectionsOnly) return true;
    const creator = creatorOf(item);
    return !!creator && (creator === me || connections.has(creator));
  });
}

/** Events with a cover image get the big card; it's a layout choice, not a ranking claim. */
export function isHighlighted(item: CalendarEntry): boolean {
  return item.type === "event" && !!(item.data as { image_url?: string | null } | null)?.image_url;
}
