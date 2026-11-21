import { test } from "node:test";
import assert from "node:assert/strict";
import { canComplete, tripDatesError, tripRange, tripStatus, todayIso } from "./tripDates.ts";

test("trip ranges read like people write them, without timezone day shifts", () => {
  assert.equal(tripRange("2099-05-01", "2099-05-06"), "May 1–6, 2099");
  assert.equal(tripRange("2099-04-28", "2099-05-03"), "Apr 28–May 3, 2099");
  assert.equal(tripRange("2099-12-30", "2100-01-02"), "Dec 30, 2099–Jan 2, 2100");
  assert.equal(tripRange("2099-05-01", "2099-05-01"), "May 1, 2099");
  assert.equal(tripRange("soon", ""), "soon");
});

test("statuses are labels, not database words", () => {
  assert.deepEqual(["planning", "booked", "completed", "cancelled", "odd"].map(tripStatus), ["Planning", "Booked", "Completed", "Cancelled", "odd"]);
});

test("new trip dates are checked before the server sees them", () => {
  const today = "2026-11-14";
  assert.equal(tripDatesError("", "2026-12-01", today), "Choose arrival and departure dates.");
  assert.equal(tripDatesError("2026-11-13", "2026-12-01", today), "Arrival can't be in the past.");
  assert.equal(tripDatesError("2026-12-02", "2026-12-01", today), "Departure must be on or after arrival.");
  assert.equal(tripDatesError("2026-11-14", "2026-11-14", today), null);
});

test("completing is offered only for booked trips whose last day has come", () => {
  assert.equal(canComplete({ status: "booked", ends_on: "2026-11-14" }, "2026-11-14"), true);
  assert.equal(canComplete({ status: "booked", ends_on: "2026-11-15" }, "2026-11-14"), false);
  assert.equal(canComplete({ status: "planning", ends_on: "2026-11-01" }, "2026-11-14"), false);
  assert.match(todayIso(new Date(2026, 0, 5)), /^2026-01-05$/);
});
