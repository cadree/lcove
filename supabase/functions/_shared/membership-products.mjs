// One list of Ether membership products. Checkout creates the current ids.
// check-membership still recognizes the older ids that are already on live
// subscriptions. A subscription also matches when its metadata.tier is set,
// so a future product id change does not mark a paid member as unsubscribed.

export const MEMBERSHIP_PRODUCT_TIERS = {
  prod_Tiqd9bhgTKWRRo: "community",
  prod_TiqeFdKIv2xWou: "elite",
  prod_TcmECcqnCALhUv: "community",
  prod_TcmEthbJUKGwjv: "elite",
};

export const MEMBERSHIP_TIER_CONFIG = {
  community: {
    product_id: "prod_Tiqd9bhgTKWRRo",
    price_id: "price_1SlOwh2O6q4dMrYLAwRO57NB",
    name: "Community Member",
    min_amount: 500,
  },
  elite: {
    product_id: "prod_TiqeFdKIv2xWou",
    price_id: "price_1SlOwv2O6q4dMrYLVppF6w4f",
    name: "Elite Member",
    amount: 2500,
  },
};

export function tierFromStripeSubscription(sub) {
  const meta = sub?.metadata || {};
  if (meta.type === "fund_donation" || meta.source === "fund_donation") return null;
  if (meta.tier === "community" || meta.tier === "elite") return meta.tier;
  const product = sub?.items?.data?.[0]?.price?.product;
  const productId = typeof product === "string" ? product : product?.id;
  return MEMBERSHIP_PRODUCT_TIERS[productId] || null;
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
