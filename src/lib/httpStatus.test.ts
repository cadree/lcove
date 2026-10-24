import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorText, httpStatusForError } from "../../supabase/functions/_shared/http-error.mjs";
import { readFunctionError, withServerFunctionMessage } from "./functionError.ts";
import { errorMessage } from "./errorMessage.ts";

describe("edge function error status", () => {
  it("maps auth failures to 401, including a missing sub claim", () => {
    const auth = [
      "Authentication error: missing sub claim",
      "invalid claim: missing sub claim",
      "No authorization header provided",
      "Missing authorization header",
      "User not authenticated or email not available",
      "Authentication failed",
      "Not authenticated",
      "Auth error: invalid claim: missing sub claim",
      "Auth: missing sub claim",
      "Unauthorized",
      "Unauthorized: Only admins can award earned credits",
      "Not authorized",
      "You don't own this store",
    ];
    for (const message of auth) {
      assert.equal(httpStatusForError(new Error(message)), 401, message);
    }
  });

  it("maps validation to 400", () => {
    const input = [
      "Minimum donation is $1",
      "Invalid mode",
      "Invalid membership tier",
      "Network ID is required",
      "Network not found",
      "No Stripe customer found for this user",
      "Invalid payment type",
      "Missing required fields: itemId, paymentType",
      "Insufficient credits. You have 1 LC, but need 5 LC",
      "This network is free, no subscription required",
      "Store website is not a valid URL",
    ];
    for (const message of input) {
      assert.equal(httpStatusForError(message), 400, message);
    }
  });

  it("keeps real failures on 500", () => {
    const failures = [
      "STRIPE_SECRET_KEY is not set",
      "Stripe key must be a secret or restricted key (sk_test_, sk_live_, rk_test_, or rk_live_).",
      "Stripe not configured",
      "Failed to create order",
      "Could not load artist profile",
      "That website did not respond",
      "LOVABLE_API_KEY not configured",
      "Invalid API Key provided: sk_test_123",
      "relation \"memberships\" does not exist",
      "insert failed",
      "Unknown error",
      "membership checkout missing user",
      "store checkout missing order",
      "stream gift missing ids",
    ];
    for (const message of failures) {
      assert.equal(httpStatusForError(new Error(message)), 500, message);
    }
    assert.equal(httpStatusForError({ message: "duplicate key", code: "23505" }), 500);
    assert.equal(httpStatusForError({ message: "Amount must be at least $0.50", type: "StripeInvalidRequestError" }), 500);
  });

  it("preserves the error string", () => {
    assert.equal(errorText(new Error("Authentication error: missing sub claim")), "Authentication error: missing sub claim");
  });
});

describe("function error messages", () => {
  it("shows the JSON error from a non-2xx response and leaves the body readable", async () => {
    const response = new Response(JSON.stringify({ error: "Minimum donation is $1" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError",
      context: response,
    });
    const result = await withServerFunctionMessage({ data: null, error });
    assert.ok(result.error instanceof Error);
    assert.equal(result.error.message, "Minimum donation is $1");
    assert.equal(await readFunctionError(error, null, "Request failed"), "Minimum donation is $1");
    assert.equal(errorMessage(result.error, "Failed to start checkout. Please try again."), "Minimum donation is $1");
  });

  it("keeps a specific message and hides the generic function error", () => {
    assert.equal(errorMessage(new Error("Network ID is required"), "Subscription failed"), "Network ID is required");
    assert.equal(
      errorMessage(new Error("Edge Function returned a non-2xx status code"), "Failed to start checkout. Please try again."),
      "Failed to start checkout. Please try again.",
    );
  });
});
