import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateOnboardingDraftStep, SIGNUP_ONBOARDING_STEPS, signupOnboardingAsksForTools } from "./signupOnboarding.ts";

describe("signup onboarding", () => {
  it("asks for name, passion, city, and the mindset questionnaire", () => {
    assert.deepEqual(SIGNUP_ONBOARDING_STEPS, ["name", "passion", "city", "questionnaire"]);
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
    assert.equal(migrateOnboardingDraftStep(9, 2), 3);
  });
});
