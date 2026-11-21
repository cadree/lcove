import assert from "node:assert/strict";
import test from "node:test";
import { matchButtonLabel, matchPhaseFromStatus } from "./peopleMatch.ts";

test("a saved invite stays pending on the card", () => {
  assert.equal(matchPhaseFromStatus("pending"), "pending");
  assert.equal(matchPhaseFromStatus("accepted"), "matched");
  assert.equal(matchPhaseFromStatus(null), "idle");
  assert.equal(matchButtonLabel("pending"), "Pending");
  assert.equal(matchButtonLabel("matched"), "Matched");
});
