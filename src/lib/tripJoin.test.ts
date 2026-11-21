import { test } from "node:test";
import assert from "node:assert/strict";
import { JOIN_LABEL, joinState, requestsUnavailable } from "./tripJoin.ts";

const trip = { id: "t1", joined: false, member_count: 2, capacity: 4 };

test("a trip card knows where I stand", () => {
  assert.equal(joinState({ ...trip, joined: true }, []), "member");
  assert.equal(joinState(trip, [{ trip_id: "t1", status: "pending" }]), "pending");
  assert.equal(joinState(trip, [{ trip_id: "t1", status: "declined" }]), "declined");
  assert.equal(joinState({ ...trip, member_count: 4 }, []), "full");
  assert.equal(joinState(trip, [{ trip_id: "other", status: "pending" }]), "open");
  assert.equal(JOIN_LABEL.open, "Request to join");
});

test("an unmigrated database falls back to the direct join", () => {
  assert.equal(requestsUnavailable({ code: "PGRST202", message: "Could not find the function" }), true);
  assert.equal(requestsUnavailable({ message: "Could not find the function public.creative_trip_request(p_note, p_trip) in the schema cache" }), true);
  assert.equal(requestsUnavailable({ message: "This trip is full" }), false);
  assert.equal(requestsUnavailable(null), false);
});
