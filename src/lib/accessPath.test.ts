import assert from "node:assert/strict";
import test from "node:test";
import { accessPath, isAwaitingVerification } from "./accessPath.ts";
import { FIRST_RUN_PATH } from "./firstRun.ts";

test("unfinished onboarding always returns to onboarding", () => {
  assert.equal(accessPath({ onboarding_completed: false, access_status: "pending" }), "/onboarding");
  assert.equal(accessPath({ onboarding_completed: false, access_status: "active" }), "/onboarding");
});

test("finished onboarding stays pending until a human approves", () => {
  assert.equal(accessPath({ onboarding_completed: true, access_status: "pending" }), "/pending");
  assert.equal(accessPath({ onboarding_completed: true, access_status: null }), "/pending");
  assert.equal(isAwaitingVerification({ onboarding_completed: true, access_status: "pending" }), true);
});

test("approval from the pending screen opens the people deck", () => {
  assert.equal(
    accessPath({ onboarding_completed: true, access_status: "active" }, "/pending"),
    FIRST_RUN_PATH,
  );
  assert.equal(accessPath({ onboarding_completed: true, access_status: "active" }, "/feed"), "/feed");
});

test("banned and denied have their own screens", () => {
  assert.equal(accessPath({ onboarding_completed: true, access_status: "banned" }), "/locked");
  assert.equal(accessPath({ onboarding_completed: true, access_status: "denied" }), "/denied");
});
