import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyConnectAccount, withdrawalBlockedReason } from "../../supabase/functions/_shared/creator-connect-status.mjs";
import {
  connectSetupAction,
  connectStatusCopy,
  connectStatusLabel,
  resolveConnectStatus,
  withdrawalsEnabled,
} from "./creatorConnectStatus.ts";

const test1 = {
  charges_enabled: true,
  payouts_enabled: false,
  details_submitted: true,
  capabilities: { transfers: "active", card_payments: "active" },
  requirements: { currently_due: [], past_due: [], disabled_reason: "other" },
};

describe("creator connect charge gate", () => {
  it("lets a charges-ready account accept money while payouts are under review", () => {
    const state = classifyConnectAccount(test1);
    assert.equal(state.status, "accepting");
    assert.equal(state.can_accept_charges, true);
    assert.equal(state.payouts_enabled, false);
    assert.equal(state.transfers_active, true);
    assert.equal(state.disabled_reason, "other");
    assert.equal(resolveConnectStatus(state), "accepting");
    assert.equal(connectStatusLabel("accepting"), "Accepting payments, payouts under review");
    assert.equal(connectSetupAction("accepting"), "manage");
    assert.equal(withdrawalsEnabled(state), false);
    assert.match(withdrawalBlockedReason(state), /reviewing bank payouts/);
    assert.doesNotMatch(connectStatusCopy("accepting"), /not been finished/);
    assert.doesNotMatch(withdrawalBlockedReason(state), /Finish setup/);
  });

  it("verifies only when bank payouts are enabled", () => {
    const state = classifyConnectAccount({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      capabilities: { transfers: "active" },
      requirements: { currently_due: [], past_due: [] },
    });
    assert.equal(state.status, "verified");
    assert.equal(state.can_accept_charges, true);
    assert.equal(withdrawalBlockedReason(state), null);
    assert.equal(connectStatusLabel("verified"), "Verified");
    assert.equal(withdrawalsEnabled(state), true);
  });

  it("asks for setup when details have not been submitted", () => {
    const state = classifyConnectAccount({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      capabilities: { transfers: "inactive" },
      requirements: { currently_due: [], past_due: [], disabled_reason: "requirements.past_due" },
    });
    assert.equal(state.status, "pending");
    assert.equal(state.can_accept_charges, false);
    assert.equal(connectStatusLabel("pending"), "Set up payouts");
    assert.equal(connectSetupAction("pending"), "setup");
    assert.match(connectStatusCopy("pending"), /not been finished/);
    assert.match(withdrawalBlockedReason(state), /Set up payouts/);
  });

  it("keeps due requirements ahead of the accepting state", () => {
    const state = classifyConnectAccount({
      ...test1,
      requirements: { currently_due: ["individual.verification.document"], past_due: [], disabled_reason: null },
    });
    assert.equal(state.can_accept_charges, true);
    assert.equal(state.status, "needs_info");
    assert.equal(connectSetupAction("needs_info"), "continue");
    assert.match(withdrawalBlockedReason(state), /needs information/);
  });

  it("does not call a submitted account unfinished when transfers are still inactive", () => {
    const state = classifyConnectAccount({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      capabilities: { transfers: "pending" },
      requirements: { currently_due: [], past_due: [], disabled_reason: "other" },
    });
    assert.equal(state.can_accept_charges, false);
    assert.equal(state.status, "review");
    assert.equal(resolveConnectStatus(state), "review");
    assert.doesNotMatch(connectStatusCopy("review"), /not been finished/);
    assert.match(withdrawalBlockedReason(state), /still reviewing/);
  });

  it("reads the accepting state from flags when an older status payload says pending", () => {
    const resolved = resolveConnectStatus({
      status: "pending",
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      currently_due: [],
    });
    assert.equal(resolved, "accepting");
    assert.equal(connectStatusLabel(resolved), "Accepting payments, payouts under review");
  });
});
