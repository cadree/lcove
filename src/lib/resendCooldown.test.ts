import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RESEND_COOLDOWN_MS, resendCooldownRemaining } from "./resendCooldown.ts";

describe("resendCooldownRemaining", () => {
  it("blocks resend until the cooldown elapses", () => {
    const sentAt = 1_000;
    assert.equal(resendCooldownRemaining(sentAt, sentAt), RESEND_COOLDOWN_MS);
    assert.equal(resendCooldownRemaining(sentAt, sentAt + 5_000), RESEND_COOLDOWN_MS - 5_000);
    assert.equal(resendCooldownRemaining(sentAt, sentAt + RESEND_COOLDOWN_MS), 0);
    assert.equal(resendCooldownRemaining(sentAt, sentAt + RESEND_COOLDOWN_MS + 1), 0);
  });

  it("allows resend when no email has been sent yet", () => {
    assert.equal(resendCooldownRemaining(null, 5_000), 0);
  });
});
