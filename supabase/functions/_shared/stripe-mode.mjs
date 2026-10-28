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

// Event checkout and host payouts stay on Stripe test keys.
export function assertEventStripeTestKey(key) {
  const value = assertStripeTestKey(key);
  if (value.includes("_live_")) {
    throw new Error("Event payments are in Stripe test mode. A live key was refused.");
  }
  return value;
}
