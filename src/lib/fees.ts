// Keep these equal to supabase/functions/_shared/fees.mjs.
// Community fund fee is 10% on store sales, studio bookings, network/film subscriptions,
// invoices, project milestone payments, and card gifts. Event tickets stay at 0%.
// Music track sales and artist subscriptions stay at 0% because those checkouts already set that.
// Fund donations and membership are platform charges, not creator destinations.
// Withdrawing earned LC does not take another 10%. 1 LC = $1 via Stripe Connect Express.

export const EVENT_PLATFORM_FEE_PERCENT = 0;
export const STORE_PLATFORM_FEE_PERCENT = 10;
export const COMMUNITY_FUND_FEE_PERCENT = 10;
