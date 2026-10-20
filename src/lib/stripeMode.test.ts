import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertStripeTestKey } from "../../supabase/functions/_shared/stripe-mode.mjs";

describe("stripe key guard", () => {
  it("accepts test and live secret or restricted keys", () => {
    assert.equal(assertStripeTestKey("sk_test_abc"), "sk_test_abc");
    assert.equal(assertStripeTestKey(" rk_test_abc "), "rk_test_abc");
    assert.equal(assertStripeTestKey("sk_live_abc"), "sk_live_abc");
    assert.equal(assertStripeTestKey("rk_live_abc"), "rk_live_abc");
  });

  it("refuses an empty or malformed key", () => {
    assert.throws(() => assertStripeTestKey(""), /not set/);
    assert.throws(() => assertStripeTestKey("   "), /not set/);
    assert.throws(() => assertStripeTestKey(undefined), /not set/);
    assert.throws(() => assertStripeTestKey("sk_live_"), /must be a secret or restricted key/);
    assert.throws(() => assertStripeTestKey("pk_live_abc"), /must be a secret or restricted key/);
    assert.throws(() => assertStripeTestKey("sk_test_abc extra"), /must be a secret or restricted key/);
  });
});
