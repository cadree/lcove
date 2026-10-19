import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IOS_DONATIONS_ENABLED, allowsStripeCheckout } from "./iosCheckout.ts";

describe("allowsStripeCheckout", () => {
  it("keeps Stripe on the web for every kind", () => {
    for (const kind of ["digital", "donation", "physical_good", "real_world_service", "event_ticket"] as const) {
      assert.equal(allowsStripeCheckout(false, kind), true);
    }
  });

  it("hides digital goods and donations on iOS and keeps real-world payments", () => {
    assert.equal(IOS_DONATIONS_ENABLED, false);
    assert.equal(allowsStripeCheckout(true, "digital"), false);
    assert.equal(allowsStripeCheckout(true, "donation"), false);
    assert.equal(allowsStripeCheckout(true, "physical_good"), true);
    assert.equal(allowsStripeCheckout(true, "real_world_service"), true);
    assert.equal(allowsStripeCheckout(true, "event_ticket"), true);
  });
});
