import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SUPPORT_ETHER_LABEL,
  SUPPORT_IN_SAFARI_LABEL,
  SUPPORT_NOW_LABEL,
  supportCadenceLabel,
  supportCheckoutLabel,
} from "./supportCopy.ts";

describe("support copy", () => {
  it("names one-time and monthly support", () => {
    assert.equal(supportCadenceLabel("one_time"), "One-time support");
    assert.equal(supportCadenceLabel("recurring"), "Monthly support");
  });

  it("keeps the dialog action labeled Support Ether", () => {
    assert.equal(SUPPORT_ETHER_LABEL, "Support Ether");
    assert.equal(supportCheckoutLabel(false), "Support Ether");
    assert.equal(supportCheckoutLabel(true), "Redirecting...");
  });

  it("names the fund page actions without calling them donations", () => {
    assert.equal(SUPPORT_IN_SAFARI_LABEL, "Support in Safari");
    assert.equal(SUPPORT_NOW_LABEL, "Support now");
    for (const label of [SUPPORT_ETHER_LABEL, SUPPORT_IN_SAFARI_LABEL, SUPPORT_NOW_LABEL, supportCadenceLabel("one_time")]) {
      assert.equal(/donat|charity|nonprofit/i.test(label), false);
    }
  });
});
