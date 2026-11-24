import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_CITIES, cityOptions, dayPreview, filterCalendar, initialCalendarView, isHighlighted, monthCells, type CalendarEntry } from "./calendarView.ts";

test("a month grid is whole weeks, so trailing days never leave a gap", () => {
  for (const month of [0, 1, 4, 10]) {
    const cells = monthCells(new Date(2026, month, 15));
    assert.equal(cells.length % 7, 0);
    assert.equal(cells.filter(Boolean).length, new Date(2026, month + 1, 0).getDate());
  }
  const nov = monthCells(new Date(2026, 10, 1));
  assert.equal(nov[0]?.getDate(), 1);
  assert.equal(nov.at(-1), null);
});

test("busy days cap at two and say how many more", () => {
  assert.deepEqual(dayPreview([1, 2, 3, 4, 5]), { shown: [1, 2], more: 3 });
  assert.deepEqual(dayPreview([1]), { shown: [1], more: 0 });
});

test("phones open on the agenda; desktops on the month", () => {
  assert.equal(initialCalendarView(390), "agenda");
  assert.equal(initialCalendarView(1280), "month");
});

const ev = (id: string, city: string, creator: string, image: string | null = null): CalendarEntry => ({ id, type: "event", start_date: "2026-11-20", city, data: { creator_id: creator, image_url: image } });
const items: CalendarEntry[] = [
  ev("a", "Atlanta", "u1", "https://x/img.jpg"),
  ev("b", "atlanta ", "u2"),
  ev("c", "Charlotte", "me"),
  { id: "p", type: "project", start_date: "2026-11-21", data: { creator_id: "u9" } },
  { id: "r", type: "personal", start_date: "2026-11-21", data: {} },
];

test("city choices come from real events, busiest first", () => {
  assert.deepEqual(cityOptions(items), [{ city: "Atlanta", count: 2 }, { city: "Charlotte", count: 1 }]);
});

test("filters: city narrows events; connections keeps my people, my events and my reminders", () => {
  const ids = (list: CalendarEntry[]) => list.map((i) => i.id);
  const none = new Set<string>();
  assert.deepEqual(ids(filterCalendar(items, { city: ALL_CITIES, connectionsOnly: false, connections: none, me: "me" })), ["a", "b", "c", "p", "r"]);
  assert.deepEqual(ids(filterCalendar(items, { city: "ATLANTA", connectionsOnly: false, connections: none, me: "me" })), ["a", "b", "p", "r"]);
  assert.deepEqual(ids(filterCalendar(items, { city: ALL_CITIES, connectionsOnly: true, connections: new Set(["u1"]), me: "me" })), ["a", "c", "r"]);
});

test("only events with a cover image get the highlighted card", () => {
  assert.deepEqual(items.map(isHighlighted), [true, false, false, false, false]);
});
