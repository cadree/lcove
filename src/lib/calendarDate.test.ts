import assert from "node:assert/strict";
import test from "node:test";
import { parseCalendarDate } from "./calendarDate.ts";

test("a date-only value keeps the saved calendar day", () => {
  const parsed = parseCalendarDate("2026-11-10");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 10);
});

test("midnight UTC is the saved calendar day, not the previous evening", () => {
  const parsed = parseCalendarDate("2026-11-10T00:00:00.000Z");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 10);
});

test("a timestamp with a clock time stays an instant", () => {
  const parsed = parseCalendarDate("2026-11-10T23:00:00.000Z");
  assert.equal(parsed.toISOString(), "2026-11-10T23:00:00.000Z");
});
