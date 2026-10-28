import Stripe from "https://esm.sh/stripe@18.5.0";
import { assertStripeTestKey } from "./stripe-mode.mjs";
import { COMMUNITY_FUND_FEE_PERCENT, communityFundFeeCents } from "./fees.mjs";
import { canAcceptCharges, classifyConnectAccount } from "./creator-connect-status.mjs";

export { canAcceptCharges, classifyConnectAccount, transfersActive, withdrawalBlockedReason } from "./creator-connect-status.mjs";

export const STRIPE_API_VERSION = "2025-08-27.basil";

export function testStripe() {
  return new Stripe(assertStripeTestKey(Deno.env.get("STRIPE_SECRET_KEY")), {
    apiVersion: STRIPE_API_VERSION,
  });
}

export async function loadProfileConnect(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, payout_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Express account that can take a destination charge.
 * profiles.payout_enabled caches canAcceptCharges (charges + transfers), not bank payouts.
 * A false cache is refreshed once, because older syncs only set the flag when payouts were enabled too.
 */
export async function verifiedDestination(supabase, userId) {
  const profile = await loadProfileConnect(supabase, userId);
  if (!profile?.stripe_connect_account_id) return null;
  if (profile.payout_enabled === true) return profile.stripe_connect_account_id;
  try {
    const stripe = testStripe();
    const state = await syncPayoutEnabled(stripe, supabase, userId, profile.stripe_connect_account_id);
    if (state.can_accept_charges) return profile.stripe_connect_account_id;
  } catch (error) {
    console.error("[creator-connect] could not refresh charge status", error);
  }
  return null;
}

export function destinationCharge(accountId, amountCents, feePercent = COMMUNITY_FUND_FEE_PERCENT) {
  if (!accountId) return {};
  const fee = communityFundFeeCents(amountCents);
  const percentFee = Math.round(Number(amountCents) * (feePercent / 100));
  const applicationFee = feePercent === COMMUNITY_FUND_FEE_PERCENT ? fee : percentFee;
  return {
    transfer_data: { destination: accountId },
    ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
  };
}

export async function ensureExpressAccount(stripe, supabase, user) {
  const profile = await loadProfileConnect(supabase, user.id);
  if (profile?.stripe_connect_account_id) return profile.stripe_connect_account_id;
  const account = await stripe.accounts.create({
    type: "express",
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: { user_id: user.id },
  });
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_connect_account_id: account.id, payout_enabled: false })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return account.id;
}

export async function syncPayoutEnabled(stripe, supabase, userId, accountId) {
  const account = await stripe.accounts.retrieve(accountId);
  const state = classifyConnectAccount(account);
  const { error } = await supabase
    .from("profiles")
    .update({ payout_enabled: canAcceptCharges(account) })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { accountId, ...state };
}
