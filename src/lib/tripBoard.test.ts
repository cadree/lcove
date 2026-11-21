import { test } from "node:test";
import assert from "node:assert/strict";
import { checklist, clock, itineraryDays, tripDays, type BoardItem } from "./tripBoard.ts";

const item = (o: Partial<BoardItem>): BoardItem => ({ id: o.title || "x", trip_id: "t", kind: "stop", title: "x", detail: "", day: null, at_time: null, image_url: null, done: false, created_by: null, created_at: "2026-11-14T00:00:00Z", ...o });

test("the itinerary reads day by day, in time order, undated last", () => {
  const days = itineraryDays([
    item({ title: "late", day: "2099-05-02", at_time: "20:00:00" }),
    item({ title: "loose" }),
    item({ title: "early", day: "2099-05-02", at_time: "07:30:00" }),
    item({ title: "first day", day: "2099-05-01" }),
    item({ kind: "packing", title: "not a stop" }),
  ]);
  assert.deepEqual(days.map((d) => [d.day, d.stops.map((s) => s.title)]), [["2099-05-01", ["first day"]], ["2099-05-02", ["early", "late"]], [null, ["loose"]]]);
});

test("checklists keep open items on top", () => {
  const list = checklist([item({ kind: "packing", title: "a", done: true }), item({ kind: "packing", title: "b" }), item({ kind: "shopping", title: "c" })], "packing");
  assert.deepEqual(list.map((i) => i.title), ["b", "a"]);
});

test("times and trip days read naturally", () => {
  assert.deepEqual(["00:05:00", "12:00:00", "18:30:00", null].map(clock), ["12:05 AM", "12:00 PM", "6:30 PM", ""]);
  assert.deepEqual(tripDays("2099-04-30", "2099-05-02"), ["2099-04-30", "2099-05-01", "2099-05-02"]);
  assert.deepEqual(tripDays("bad", "2099-05-02"), []);
});
