import { test } from "node:test";
import assert from "node:assert/strict";
import { callApplyHref, callCity, callDateLabel, callDraftError, callEnded, roleOpen } from "./openCalls.ts";

const NOW = new Date("2026-11-15T18:00:00Z");
const role = { id: "r", role_name: "Stylist", slots_available: 1, slots_filled: 0, is_locked: false };
const draft = { roleId: "r", newRole: "", date: "2026-11-20", city: "Charlotte, NC", description: "" };

test("a call ends when closed, filled or past its date", () => {
  const call = { status: "open" as const, call_date: "2026-11-15" };
  assert.equal(callEnded(call, role, NOW), null);
  assert.equal(callEnded({ ...call, status: "closed" }, role, NOW), "Closed");
  assert.equal(callEnded(call, { ...role, slots_filled: 1 }, NOW), "Role filled");
  assert.equal(callEnded(call, { ...role, is_locked: true }, NOW), "Role filled");
  assert.equal(callEnded(call, undefined, NOW), "Role filled");
  assert.equal(callEnded({ ...call, call_date: "2026-11-14" }, role, NOW), "Date passed");
  assert.equal(roleOpen(role), true);
});

test("cities resolve to a key, never an address", () => {
  assert.deepEqual(callCity("Charlotte, NC"), { key: "charlotte|nc", label: "Charlotte, NC" });
  assert.equal(callCity(""), null);
  assert.equal(callCity("   "), null);
});

test("draft checks", () => {
  assert.equal(callDraftError(draft, NOW), null);
  assert.match(callDraftError({ ...draft, roleId: null }, NOW)!, /Pick a role/);
  assert.equal(callDraftError({ ...draft, roleId: null, newRole: "Gaffer" }, NOW), null);
  assert.match(callDraftError({ ...draft, date: "" }, NOW)!, /Pick a date/);
  assert.match(callDraftError({ ...draft, date: "2026-11-14" }, NOW)!, /12 months/);
  assert.match(callDraftError({ ...draft, date: "2027-11-16" }, NOW)!, /12 months/);
  assert.match(callDraftError({ ...draft, city: "" }, NOW)!, /city/);
  assert.match(callDraftError({ ...draft, description: "x".repeat(281) }, NOW)!, /280/);
});

test("labels and links", () => {
  assert.equal(callDateLabel("2026-11-20"), "Fri, Nov 20");
  assert.equal(callApplyHref({ project_id: "p1", role_id: "r 1" }), "/project/p1?role=r%201");
});
