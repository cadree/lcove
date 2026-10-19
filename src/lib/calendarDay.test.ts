import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarDayKey, dayDividerLabel } from "./calendarDay.ts";

/**
 * 2026-10-20 02:59 UTC is 22:59 on 2026-10-19 in US Eastern (EDT, UTC-4).
 * The UTC date has rolled over; the viewer's local calendar day has not.
 */
const EASTERN = "America/New_York";
const NOW = new Date("2026-10-20T02:59:00.000Z");
const SENT_AT = "2026-10-20T02:59:00.000Z";

describe("dayDividerLabel", () => {
  it("labels a 02:59Z message as Today when local time is 22:59 the previous UTC day", () => {
    assert.equal(new Date(SENT_AT).toISOString().slice(0, 10), "2026-10-20");
    assert.equal(calendarDayKey(NOW, EASTERN), "2026-10-19");
    assert.equal(calendarDayKey(SENT_AT, EASTERN), "2026-10-19");
    assert.equal(dayDividerLabel(SENT_AT, { now: NOW, timeZone: EASTERN }), "Today");
    assert.equal(
      dayDividerLabel(SENT_AT, { now: NOW, timeZone: EASTERN, older: "short" }),
      "Today",
    );
  });

  it("labels the previous local evening as Yesterday after UTC has moved on", () => {
    const previousEvening = "2026-10-19T02:59:00.000Z";
    assert.equal(calendarDayKey(previousEvening, EASTERN), "2026-10-18");
    assert.equal(dayDividerLabel(previousEvening, { now: NOW, timeZone: EASTERN }), "Yesterday");
  });

  it("prints an older local day instead of the UTC date", () => {
    const older = "2026-10-17T02:59:00.000Z";
    assert.equal(calendarDayKey(older, EASTERN), "2026-10-16");
    assert.equal(dayDividerLabel(older, { now: NOW, timeZone: EASTERN }), "October 16, 2026");
    assert.equal(
      dayDividerLabel(older, { now: NOW, timeZone: EASTERN, older: "short" }),
      "Oct 16",
    );
  });
});
