import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, cleanOpenTo, currentOpenTo, hasOpenTo, openToByUser, openToLastDay, openToUntilError, openToUntilLabel,
} from "./openTo.ts";

const NOW = new Date("2026-11-15T15:00:00Z");

test("cleanOpenTo keeps known tags in preset order", () => {
  assert.deepEqual(cleanOpenTo(["events", "bogus", "shoots", "events"]), ["shoots", "events"]);
});

test("tags without a date last 90 days from the last save", () => {
  const row = { user_id: "u", tags: ["shoots"], until: null, updated_at: "2026-08-17T23:00:00Z" };
  assert.equal(openToLastDay(row), "2026-11-15");
  assert.deepEqual(currentOpenTo(row, NOW), ["shoots"]);
  assert.deepEqual(currentOpenTo(row, new Date("2026-11-16T00:00:01Z")), []);
});

test("an end date shows through that day, then expires", () => {
  const row = { user_id: "u", tags: ["collabs"], until: "2026-11-15", updated_at: "2026-11-01T00:00:00Z" };
  assert.deepEqual(currentOpenTo(row, NOW), ["collabs"]);
  assert.deepEqual(currentOpenTo({ ...row, until: "2026-11-14" }, NOW), []);
  assert.equal(openToUntilLabel(row), "Until Nov 15");
  assert.equal(openToUntilLabel({ until: null }), null);
});

test("end date must be today to 180 days out", () => {
  assert.equal(openToUntilError(null, NOW), null);
  assert.equal(openToUntilError("2026-11-15", NOW), null);
  assert.equal(openToUntilError(addDays("2026-11-15", 180), NOW), null);
  assert.match(openToUntilError("2026-11-14", NOW)!, /today/);
  assert.match(openToUntilError(addDays("2026-11-15", 181), NOW)!, /6 months/);
  assert.match(openToUntilError("soon", NOW)!, /Pick a date/);
});

test("people filter needs every picked tag", () => {
  assert.equal(hasOpenTo(["shoots", "paid_gigs"], []), true);
  assert.equal(hasOpenTo(["shoots", "paid_gigs"], ["paid_gigs"]), true);
  assert.equal(hasOpenTo(["shoots"], ["paid_gigs", "shoots"]), false);
  assert.equal(hasOpenTo(undefined, ["shoots"]), false);
});

test("openToByUser drops expired and empty rows", () => {
  const map = openToByUser([
    { user_id: "a", tags: ["shoots"], until: "2026-12-01", updated_at: "2026-11-01T00:00:00Z" },
    { user_id: "b", tags: ["events"], until: "2026-11-01", updated_at: "2026-10-01T00:00:00Z" },
    { user_id: "c", tags: [], until: null, updated_at: "2026-11-10T00:00:00Z" },
  ], NOW);
  assert.deepEqual([...map.keys()], ["a"]);
});
