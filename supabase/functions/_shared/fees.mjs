// Keep these equal to src/lib/fees.ts. docs/stripe-setup.md is the written rate.
// Event tickets charge no platform fee. Store checkout on Ether is 10% of the item price.
// Network subscriptions and studio bookings charge COMMUNITY_FUND_FEE_PERCENT.
// That fee is earmarked for the community fund.

export const EVENT_PLATFORM_FEE_PERCENT = 0;
export const STORE_PLATFORM_FEE_PERCENT = 10;
export const COMMUNITY_FUND_FEE_PERCENT = 10;

export function communityFundFeeCents(amountCents) {
  const cents = Number(amountCents);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents * (COMMUNITY_FUND_FEE_PERCENT / 100));
}
