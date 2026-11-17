import assert from "node:assert/strict";
import test from "node:test";
import { emailSendingHelp } from "./authEmailErrors.ts";

test("email sender quota gives actionable advice instead of claiming SMTP failed", () => {
  const fromCode = emailSendingHelp({ code: "over_email_send_rate_limit", status: 429, message: "Too Many Requests" });
  assert.equal(fromCode?.title, "Verification emails temporarily limited");
  assert.match(fromCode?.description || "", /recent code/);
  assert.match(fromCode?.description || "", /sign in/);
  assert.deepEqual(emailSendingHelp({ message: "email rate limit exceeded", status: 429 }), fromCode);
});

test("does not confuse bad SMTP credentials, expired OTP or user errors with a quota", () => {
  assert.equal(emailSendingHelp({ message: '535 "Authentication credentials invalid"', code: "unexpected_failure" }), null);
  assert.equal(emailSendingHelp({ message: "Token has expired", code: "otp_expired" }), null);
  assert.equal(emailSendingHelp({ message: "Invalid login credentials" }), null);
});
