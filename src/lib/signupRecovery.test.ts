import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySignup,
  emailSendingHelp,
  isExistingAccountSignup,
  resendWaitRemaining,
  retryAfterSeconds,
  signupEmailDeliveryFailed,
  signupLimitNextStep,
  SIGNUP_NOT_SENT_NOTE,
} from "./signupRecovery.ts";

// Shapes copied from staging Auth responses on Nov 22, 2026.
const perAddressLimit = {
  code: "over_email_send_rate_limit",
  status: 429,
  message: "For security purposes, you can only request this after 49 seconds.",
};

test("a confirmed email joining again is an existing account, not a sent code", () => {
  // 200, no session, fake user id, identities: [] and no email sent.
  assert.deepEqual(classifySignup({ error: null, session: null, user: { identities: [] } }), { kind: "existing-account" });
  assert.equal(isExistingAccountSignup({ identities: [] }), true);
});

test("a new or unverified email gets the code screen", () => {
  assert.deepEqual(classifySignup({ error: null, session: null, user: { identities: [{}] } }), { kind: "code-sent" });
  assert.equal(isExistingAccountSignup({ identities: [{}] }), false);
  assert.equal(isExistingAccountSignup(null), false);
  // Older Auth builds can omit identities; treat that as a normal signup.
  assert.equal(isExistingAccountSignup({}), false);
});

test("a session means auto-confirm signed them in", () => {
  assert.deepEqual(classifySignup({ error: null, session: {}, user: { identities: [{}] } }), { kind: "signed-in" });
});

test("email limits keep the user on the code screen with the server's wait", () => {
  assert.deepEqual(classifySignup({ error: perAddressLimit, session: null }), { kind: "rate-limited", retryAfterSeconds: 49 });
  assert.deepEqual(
    classifySignup({ error: { message: "email rate limit exceeded", status: 429 }, session: null }),
    { kind: "rate-limited", retryAfterSeconds: null },
  );
});

test("SMTP failures offer resend; already registered offers sign-in; other errors stay errors", () => {
  assert.deepEqual(classifySignup({ error: { message: '535 "Authentication credentials invalid"' }, session: null }), { kind: "email-failed" });
  assert.deepEqual(classifySignup({ error: { message: "User already registered" }, session: null }), { kind: "existing-account" });
  assert.deepEqual(classifySignup({ error: { message: "Database error saving new user" }, session: null }), { kind: "error" });
});

test("retry seconds come from the Auth message", () => {
  assert.equal(retryAfterSeconds(perAddressLimit), 49);
  assert.equal(retryAfterSeconds({ message: "you can only request this after 1 second" }), 1);
  assert.equal(retryAfterSeconds({ message: "Too Many Requests" }), null);
  assert.equal(retryAfterSeconds(null), null);
});

test("limit help says when to retry and never blames credentials or the code", () => {
  assert.match(emailSendingHelp(perAddressLimit)?.description || "", /49s/);
  assert.match(emailSendingHelp({ code: "over_email_send_rate_limit" })?.description || "", /few minutes/);
  assert.equal(emailSendingHelp({ message: "Token has expired", code: "otp_expired" }), null);
  assert.equal(emailSendingHelp({ message: "Invalid login credentials" }), null);
  assert.equal(signupEmailDeliveryFailed({ message: "Error sending confirmation email" }), true);
  assert.equal(signupEmailDeliveryFailed({ message: "User already registered" }), false);
});

test("resend waits for the longer of the local cooldown and the server's wait", () => {
  assert.equal(resendWaitRemaining(null, null, 5_000, 60_000), 0);
  assert.equal(resendWaitRemaining(1_000, null, 11_000, 60_000), 50_000);
  assert.equal(resendWaitRemaining(null, 20_000, 5_000, 60_000), 15_000);
  assert.equal(resendWaitRemaining(1_000, 100_000, 11_000, 60_000), 89_000);
  assert.equal(resendWaitRemaining(1_000, 2_000, 100_000, 60_000), 0);
});

test("a project-wide email limit on Join stays on Join; a per-address limit opens the code screen", () => {
  assert.equal(signupLimitNextStep(null), "stay-on-join");
  assert.equal(signupLimitNextStep(49), "code-screen");
  const quota = classifySignup({ error: { code: "over_email_send_rate_limit", message: "email rate limit exceeded", status: 429 }, session: null });
  assert.deepEqual(quota, { kind: "rate-limited", retryAfterSeconds: null });
  assert.equal(signupLimitNextStep(quota.kind === "rate-limited" ? quota.retryAfterSeconds : 0), "stay-on-join");
  assert.match(SIGNUP_NOT_SENT_NOTE, /tap Join again/);
  assert.doesNotMatch(SIGNUP_NOT_SENT_NOTE, /code we sent/i);
});
