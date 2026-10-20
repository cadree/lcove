import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertStripeTestKey } from "../../supabase/functions/_shared/stripe-mode.mjs";

describe("stripe test mode", () => {
  it("accepts a test secret and refuses a live secret", () => {
    assert.equal(assertStripeTestKey("sk_test_abc"), "sk_test_abc");
    assert.throws(() => assertStripeTestKey("sk_live_abc"), /live mode is refused/);
    assert.throws(() => assertStripeTestKey(""), /not set/);
  });
});
