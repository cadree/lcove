import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateOnboardingDraftStep, SIGNUP_ONBOARDING_STEPS, signupOnboardingAsksForTools } from "./signupOnboarding.ts";

describe("signup onboarding", () => {
  it("asks for identity, passion, city, a reviewable link, and the oath", () => {
    assert.deepEqual(SIGNUP_ONBOARDING_STEPS, ["name", "passion", "city", "proof", "pledge"]);
    assert.equal(signupOnboardingAsksForTools(), false);
  });

  it("maps the old longer draft onto the shorter list", () => {
    assert.equal(migrateOnboardingDraftStep(0, undefined), 0);
    assert.equal(migrateOnboardingDraftStep(1, undefined), 0);
    assert.equal(migrateOnboardingDraftStep(2, undefined), 1);
    assert.equal(migrateOnboardingDraftStep(3, undefined), 2);
    assert.equal(migrateOnboardingDraftStep(4, undefined), 3);
    assert.equal(migrateOnboardingDraftStep(6, undefined), 3);
    assert.equal(migrateOnboardingDraftStep(2, 2), 2);
    assert.equal(migrateOnboardingDraftStep(3, 2), 3);
    assert.equal(migrateOnboardingDraftStep(9, 2), 3);
    assert.equal(migrateOnboardingDraftStep(4, 3), 4);
  });
});
