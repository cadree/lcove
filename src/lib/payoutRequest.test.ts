import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAYOUT_UPGRADE_MESSAGE, interpretPayoutRequest } from "../../supabase/functions/_shared/payout-request.mjs";

describe("payout request compatibility", () => {
  it("routes the live Wallet body through Connect", () => {
    const decision = interpretPayoutRequest({ amount: 25, payout_method_id: "pm_bank_123" });
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.amount, 25);
    assert.equal(decision.legacy, true);
    assert.equal(decision.status, undefined);
  });

  it("keeps the Wallet call that sends use_credits", () => {
    const decision = interpretPayoutRequest({ amount: "10", use_credits: true, project_id: "proj" });
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.amount, 10);
    assert.equal(decision.legacy, false);
    assert.equal(decision.project_id, "proj");
  });

  it("returns an upgrade message without a breaking status", () => {
    const decision = interpretPayoutRequest({ amount: 10 });
    assert.deepEqual(decision, { ok: false, status: 200, error: PAYOUT_UPGRADE_MESSAGE });
  });

  it("rejects a non-positive amount with status 200", () => {
    assert.equal(interpretPayoutRequest({ amount: 0, payout_method_id: "pm_1" }).status, 200);
    assert.equal(interpretPayoutRequest({ amount: -5, use_credits: true }).ok, false);
  });
});
