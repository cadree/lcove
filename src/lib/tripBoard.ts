/** Trip board shapes and grouping. Pure, so the layout rules are testable. */
export type BoardKind = "stop" | "photo" | "packing" | "shopping";

export interface BoardItem {
  id: string;
  trip_id: string;
  kind: string;
  title: string;
  detail: string;
  day: string | null;
  at_time: string | null;
  image_url: string | null;
  done: boolean;
  created_by: string | null;
  created_at: string;
}

/** Itinerary stops grouped by day (undated last), each day in time order. */
export function itineraryDays(items: BoardItem[]): { day: string | null; stops: BoardItem[] }[] {
  const stops = items.filter((i) => i.kind === "stop");
  const days = new Map<string | null, BoardItem[]>();
  for (const stop of stops) days.set(stop.day, [...(days.get(stop.day) || []), stop]);
  const order = [...days.keys()].sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)));
  return order.map((day) => ({
    day,
    stops: (days.get(day) || []).sort(
      (a, b) => (a.at_time || "99").localeCompare(b.at_time || "99") || a.created_at.localeCompare(b.created_at)
    ),
  }));
}

/** A checklist: open items first (oldest first), then done ones. */
export function checklist(items: BoardItem[], kind: "packing" | "shopping"): BoardItem[] {
  return items
    .filter((i) => i.kind === kind)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.created_at.localeCompare(b.created_at));
}

/** "18:30:00" → "6:30 PM". */
export function clock(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Days a stop can be on: the trip's own dates. */
export function tripDays(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(last.getTime())) return out;
  while (d <= last && out.length < 60) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
