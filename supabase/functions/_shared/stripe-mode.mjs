// Membership and music checkout accept a Stripe test or live secret.
// The same check is used by the other payment functions, which read one STRIPE_SECRET_KEY.

const STRIPE_SECRET_KEY = /^(?:sk|rk)_(?:test|live)_\S+$/;

export function assertStripeTestKey(key) {
  const value = typeof key === "string" ? key.trim() : "";
  if (!value) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!STRIPE_SECRET_KEY.test(value)) {
    throw new Error("Stripe key must be a secret or restricted key (sk_test_, sk_live_, rk_test_, or rk_live_).");
  }
  return value;
}
