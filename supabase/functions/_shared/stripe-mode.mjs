// Membership and music checkout stay on Stripe test keys.

export function assertStripeTestKey(key) {
  const value = typeof key === "string" ? key.trim() : "";
  if (!value) throw new Error("STRIPE_SECRET_KEY is not set");
  if (value.startsWith("sk_live_") || value.startsWith("rk_live_")) {
    throw new Error("Stripe live mode is refused. Membership and music stay on a test key.");
  }
  if (!value.startsWith("sk_test_") && !value.startsWith("rk_test_")) {
    throw new Error("Stripe key must be a test key (sk_test_).");
  }
  return value;
}
