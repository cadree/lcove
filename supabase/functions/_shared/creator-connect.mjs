import Stripe from "https://esm.sh/stripe@18.5.0";
import { assertStripeTestKey } from "./stripe-mode.mjs";
import { COMMUNITY_FUND_FEE_PERCENT, communityFundFeeCents } from "./fees.mjs";

export const STRIPE_API_VERSION = "2025-08-27.basil";

export function testStripe() {
  return new Stripe(assertStripeTestKey(Deno.env.get("STRIPE_SECRET_KEY")), {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function classifyConnectAccount(account) {
  const due = [
    ...(account?.requirements?.currently_due ?? []),
    ...(account?.requirements?.past_due ?? []),
  ];
  let status = "pending";
  if (!account) status = "pending";
  else if (due.length > 0) status = "needs_info";
  else if (account.charges_enabled && account.payouts_enabled) status = "verified";
  return {
    status,
    charges_enabled: account?.charges_enabled === true,
    payouts_enabled: account?.payouts_enabled === true,
    details_submitted: account?.details_submitted === true,
    currently_due: due,
    disabled_reason: account?.requirements?.disabled_reason ?? null,
  };
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

/** Verified Express account on the creator's profile. Null when they cannot be paid yet. */
export async function verifiedDestination(supabase, userId) {
  const profile = await loadProfileConnect(supabase, userId);
  if (!profile?.stripe_connect_account_id || profile.payout_enabled !== true) return null;
  return profile.stripe_connect_account_id;
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
    .update({ payout_enabled: state.status === "verified" })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { accountId, ...state };
}
