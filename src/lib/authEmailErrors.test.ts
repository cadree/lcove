import assert from "node:assert/strict";
import test from "node:test";
import { emailSendingHelp, signupEmailDeliveryFailed } from "./authEmailErrors.ts";

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

test("signup email delivery problems offer code recovery, unlike unrelated signup errors", () => {
  assert.equal(signupEmailDeliveryFailed({ code:"over_email_send_rate_limit", message:"email rate limit exceeded",status:429 }),true);
  assert.equal(signupEmailDeliveryFailed({ code:"unexpected_failure", message:'535 "Authentication credentials invalid"',status:500 }),true);
  assert.equal(signupEmailDeliveryFailed({ message:"Error sending confirmation email" }),true);
  assert.equal(signupEmailDeliveryFailed({ message:"User already registered" }),false);
  assert.equal(signupEmailDeliveryFailed({ message:"Database error saving new user" }),false);
});
