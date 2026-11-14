import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGrantEligible } from "./grantEligibility.ts";

describe("isGrantEligible", () => {
  it("follows the $50 contribution rule for every tier", () => {
    assert.equal(isGrantEligible(25), false);
    assert.equal(isGrantEligible(49.99), false);
    assert.equal(isGrantEligible(50), true);
    assert.equal(isGrantEligible(0), false);
    assert.equal(isGrantEligible(null), false);
  });
});
