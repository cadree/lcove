// Keep these equal to supabase/functions/_shared/fees.mjs.
// Community fund fee is 10% on store sales, studio bookings, network/film subscriptions,
// invoices, project milestone payments, and card gifts. Event tickets stay at 0%.
// Music track sales and artist subscriptions stay at 0% because those checkouts already set that.
// Fund donations and membership are platform charges, not creator destinations.
// Withdrawing earned LC does not take another 10%. 1 LC = $1 via Stripe Connect Express.

export const EVENT_PLATFORM_FEE_PERCENT = 0;
export const STORE_PLATFORM_FEE_PERCENT = 10;
export const COMMUNITY_FUND_FEE_PERCENT = 10;

export function platformFeeCents(amountCents: number, percent: number): number {
  const cents = Number(amountCents);
  const rate = Number(percent);
  if (!Number.isFinite(cents) || cents <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(cents * (rate / 100));
}

export function storeCashSplit(merchandiseCents: number, shippingCents: number, taxCents: number) {
  const merchandise = Math.max(0, Math.round(Number(merchandiseCents) || 0));
  const shipping = Math.max(0, Math.round(Number(shippingCents) || 0));
  const tax = Math.max(0, Math.round(Number(taxCents) || 0));
  const fee = platformFeeCents(merchandise, STORE_PLATFORM_FEE_PERCENT);
  return {
    merchandiseCents: merchandise,
    shippingCents: shipping,
    taxCents: tax,
    platformFeeCents: fee,
    sellerCents: merchandise - fee + shipping + tax,
    totalCents: merchandise + shipping + tax,
  };
}
