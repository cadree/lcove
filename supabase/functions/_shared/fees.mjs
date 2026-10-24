// Keep these equal to src/lib/fees.ts. docs/stripe-setup.md is the written rate.
// COMMUNITY_FUND_FEE_PERCENT (10) applies to store sales, studio bookings, network and film
// subscriptions, invoices, project payments, and card gifts. Event tickets stay at 0.
// Music sales stay at 0 in their own checkout. Donations and membership are platform charges.
// Earned-credit payouts do not take this fee again.

export const EVENT_PLATFORM_FEE_PERCENT = 0;
export const STORE_PLATFORM_FEE_PERCENT = 10;
export const COMMUNITY_FUND_FEE_PERCENT = 10;

export function communityFundFeeCents(amountCents) {
  return platformFeeCents(amountCents, COMMUNITY_FUND_FEE_PERCENT);
}

export function platformFeeCents(amountCents, percent) {
  const cents = Number(amountCents);
  const rate = Number(percent);
  if (!Number.isFinite(cents) || cents <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(cents * (rate / 100));
}

// Store cash split. Shipping and tax are not part of the platform fee.
// Event tickets use EVENT_PLATFORM_FEE_PERCENT, which is 0, so hosts keep the charge
// and only card processing fees apply.
export function storeCashSplit(merchandiseCents, shippingCents, taxCents) {
  const merch = Math.max(0, Math.round(Number(merchandiseCents) || 0));
  const shipping = Math.max(0, Math.round(Number(shippingCents) || 0));
  const tax = Math.max(0, Math.round(Number(taxCents) || 0));
  const fee = platformFeeCents(merch, STORE_PLATFORM_FEE_PERCENT);
  return {
    merchandiseCents: merch,
    shippingCents: shipping,
    taxCents: tax,
    platformFeeCents: fee,
    sellerCents: merch - fee + shipping + tax,
    totalCents: merch + shipping + tax,
  };
}
