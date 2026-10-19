// Membership catalog for the Stripe account this project uses.
// Product and price ids come from function secrets. There is no fallback id.

const MEMBERSHIP_ENV = [
  ["community", "product_id", "STRIPE_PRODUCT_COMMUNITY"],
  ["community", "price_id", "STRIPE_PRICE_COMMUNITY"],
  ["elite", "product_id", "STRIPE_PRODUCT_ELITE"],
  ["elite", "price_id", "STRIPE_PRICE_ELITE"],
];

const NON_MEMBERSHIP_TYPES = new Set([
  "artist_subscription",
  "event_ticket",
  "exclusive_track_purchase",
  "network_subscription",
  "store_order",
]);

function envValue(name, env) {
  let raw = "";
  if (env && typeof env.get === "function") {
    const value = env.get(name);
    raw = typeof value === "string" ? value : "";
  } else if (typeof Deno !== "undefined" && Deno.env?.get) {
    raw = Deno.env.get(name) || "";
  } else if (typeof process !== "undefined" && process.env) {
    raw = process.env[name] || "";
  }
  return raw.trim();
}

export function membershipNotConfigured(missing) {
  return new Error(`membership not configured: missing ${missing.join(", ")}`);
}

export function readMembershipEnv(env) {
  const missing = [];
  const values = {
    community: { product_id: "", price_id: "" },
    elite: { product_id: "", price_id: "" },
  };
  for (const [tier, field, name] of MEMBERSHIP_ENV) {
    const value = envValue(name, env);
    if (!value) missing.push(name);
    else values[tier][field] = value;
  }
  return { missing, values };
}

export function requireMembershipConfig(env) {
  const { missing, values } = readMembershipEnv(env);
  if (missing.length) throw membershipNotConfigured(missing);
  return {
    community: {
      product_id: values.community.product_id,
      price_id: values.community.price_id,
      name: "Community Member",
      min_amount: 500,
    },
    elite: {
      product_id: values.elite.product_id,
      price_id: values.elite.price_id,
      name: "Elite Member",
      amount: 2500,
    },
  };
}

export function tierFromStripeSubscription(sub, env) {
  const meta = sub?.metadata || {};
  if (meta.type === "fund_donation" || meta.source === "fund_donation") return null;
  if (meta.tier === "community" || meta.tier === "elite") return meta.tier;
  if (NON_MEMBERSHIP_TYPES.has(meta.type)) return null;

  const product = sub?.items?.data?.[0]?.price?.product;
  const productId = typeof product === "string" ? product : product?.id;
  if (!productId) return null;

  const { missing, values } = readMembershipEnv(env);
  const productMissing = missing.filter((name) => name.startsWith("STRIPE_PRODUCT_"));
  if (productMissing.length) throw membershipNotConfigured(productMissing);
  if (productId === values.community.product_id) return "community";
  if (productId === values.elite.product_id) return "elite";
  return null;
}

export function mapMembershipStatus(sub, eventType) {
  if (eventType === "customer.subscription.deleted" || eventType === "invoice.payment_failed") {
    return eventType === "invoice.payment_failed" ? "past_due" : "cancelled";
  }
  if (!sub) return "cancelled";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "active") return "active";
  if (sub.status === "past_due" || sub.status === "unpaid") return "past_due";
  return "cancelled";
}
