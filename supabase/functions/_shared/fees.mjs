// Keep these equal to src/lib/fees.ts. docs/stripe-setup.md is the written rate.
// COMMUNITY_FUND_FEE_PERCENT (10) applies to store sales, studio bookings, network and film
// subscriptions, invoices, project payments, and card gifts. Event tickets stay at 0.
// Music sales stay at 0 in their own checkout. Donations and membership are platform charges.
// Earned-credit payouts do not take this fee again.

export const EVENT_PLATFORM_FEE_PERCENT = 0;
export const STORE_PLATFORM_FEE_PERCENT = 10;
export const COMMUNITY_FUND_FEE_PERCENT = 10;

export function communityFundFeeCents(amountCents) {
  const cents = Number(amountCents);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents * (COMMUNITY_FUND_FEE_PERCENT / 100));
}
