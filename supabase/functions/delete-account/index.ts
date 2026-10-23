import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PENDING_PAYOUT = "You still have a payout in progress. Wait until it finishes, then delete your account.";
const PENDING_CREDIT = "You still have earned credit that can be paid out. Withdraw it before deleting your account.";
const PENDING_HOLD = "Money is still held for a project, order, or booking. Wait until it is paid out or refunded, then try again.";
const PENDING_STRIPE = "Stripe still shows a pending or available balance. Withdraw it before deleting your account.";
const STRIPE_UNKNOWN = "This account has a Stripe payout connection and we could not confirm the balance is zero, so it was not deleted.";
const STRIPE_SUBSCRIPTION = "A Stripe subscription could not be cancelled, so the account was not deleted.";
const MONEY_CHECK_FAILED = "We could not confirm that no money is pending, so the account was not deleted.";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01"
    || error.code === "42703"
    || error.code === "PGRST202"
    || /does not exist/i.test(error.message ?? "")
    || /could not find the function/i.test(error.message ?? "");
}

async function countPending(
  supabase: SupabaseClient,
  table: string,
  build: (query: ReturnType<SupabaseClient["from"]>) => PromiseLike<{ count: number | null; error: { code?: string; message?: string } | null }>,
): Promise<number> {
  const query = supabase.from(table);
  const { count, error } = await build(query);
  if (error) {
    if (isMissingRelation(error)) return 0;
    throw new Error(MONEY_CHECK_FAILED);
  }
  return count ?? 0;
}

async function connectAccountIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const ids = new Set<string>();

  const profile = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error && !isMissingRelation(profile.error)) throw new Error(MONEY_CHECK_FAILED);
  if (profile.data?.stripe_connect_account_id) ids.add(profile.data.stripe_connect_account_id);

  const stores = await supabase
    .from("stores")
    .select("stripe_connect_account_id")
    .eq("user_id", userId);
  if (stores.error && !isMissingRelation(stores.error)) throw new Error(MONEY_CHECK_FAILED);
  for (const row of stores.data ?? []) {
    if (row.stripe_connect_account_id) ids.add(row.stripe_connect_account_id);
  }

  const networks = await supabase
    .from("networks")
    .select("stripe_connect_account_id")
    .eq("owner_id", userId);
  if (networks.error && !isMissingRelation(networks.error)) throw new Error(MONEY_CHECK_FAILED);
  for (const row of networks.data ?? []) {
    if (row.stripe_connect_account_id) ids.add(row.stripe_connect_account_id);
  }

  return [...ids];
}

async function assertNoPendingMoney(supabase: SupabaseClient, userId: string, email: string | undefined) {
  const payouts = await countPending(supabase, "payouts", (query) =>
    query
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]),
  );
  if (payouts > 0) throw new Error(PENDING_PAYOUT);

  const credits = await supabase
    .from("user_credits")
    .select("earned_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (credits.error && !isMissingRelation(credits.error)) throw new Error(MONEY_CHECK_FAILED);
  if (Number(credits.data?.earned_balance ?? 0) > 0) throw new Error(PENDING_CREDIT);

  const escrow = await countPending(supabase, "escrow_holdings", (query) =>
    query
      .select("id", { count: "exact", head: true })
      .or(`payee_id.eq.${userId},payer_id.eq.${userId}`)
      .in("status", ["held", "disputed"]),
  );
  if (escrow > 0) throw new Error(PENDING_HOLD);

  const transactions = await countPending(supabase, "transactions", (query) =>
    query
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]),
  );
  if (transactions > 0) throw new Error(PENDING_HOLD);

  const stores = await supabase.from("stores").select("id").eq("user_id", userId);
  if (stores.error && !isMissingRelation(stores.error)) throw new Error(MONEY_CHECK_FAILED);
  const storeIds = (stores.data ?? []).map((store) => store.id).filter(Boolean);
  if (storeIds.length > 0) {
    const storeOrders = await supabase
      .from("store_orders")
      .select("id")
      .in("store_id", storeIds)
      .in("seller_payout_status", ["pending", "processing"])
      .gt("seller_amount", 0);
    if (storeOrders.error && !isMissingRelation(storeOrders.error)) throw new Error(MONEY_CHECK_FAILED);
    if ((storeOrders.data ?? []).length > 0) throw new Error(PENDING_HOLD);
  }

  const bookings = await countPending(supabase, "studio_bookings", (query) =>
    query
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .in("seller_payout_status", ["pending", "processing"])
      .gt("seller_amount", 0),
  );
  if (bookings > 0) throw new Error(PENDING_HOLD);

  const accountIds = await connectAccountIds(supabase, userId);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (accountIds.length > 0 && !stripeKey) {
    throw new Error(STRIPE_UNKNOWN);
  }

  if (!stripeKey) return;

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  for (const accountId of accountIds) {
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
      const cents = [...(balance.available ?? []), ...(balance.pending ?? [])]
        .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
      if (cents > 0) throw new Error(PENDING_STRIPE);
    } catch (error) {
      if (error instanceof Error && error.message === PENDING_STRIPE) throw error;
      throw new Error(STRIPE_UNKNOWN);
    }
  }

  if (!email) return;

  await cancelCustomerSubscriptions(stripe, email);
}

const BILLING_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

async function cancelCustomerSubscriptions(stripe: Stripe, email: string) {
  try {
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 20,
      });
      for (const subscription of subscriptions.data) {
        if (!BILLING_STATUSES.includes(subscription.status)) continue;
        await stripe.subscriptions.cancel(subscription.id);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === STRIPE_SUBSCRIPTION) throw error;
    throw new Error(STRIPE_SUBSCRIPTION);
  }
}

async function removeStorage(supabase: SupabaseClient, userId: string) {
  for (const bucket of ["media", "avatars"]) {
    const listed = await supabase.storage.from(bucket).list(userId, { limit: 100 });
    if (listed.error || !listed.data?.length) continue;
    const paths = listed.data.map((file) => `${userId}/${file.name}`);
    await supabase.storage.from(bucket).remove(paths);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Account deletion is not configured" });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "Sign in to delete your account" });
    }

    const token = authHeader.slice(7).trim();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return json(401, { error: "Sign in to delete your account" });
    }

    // Body is ignored. The deleted user is always the token subject.
    const userId = userData.user.id;

    await assertNoPendingMoney(admin, userId, userData.user.email ?? undefined);

    const { error: anonymizeError } = await admin
      .from("profiles")
      .update({
        display_name: "Deleted member",
        bio: null,
        avatar_url: null,
        phone: null,
        city: null,
        city_display: null,
        city_key: null,
        social_links: null,
      })
      .eq("user_id", userId);
    if (anonymizeError && !isMissingRelation(anonymizeError)) {
      return json(500, { error: "Could not anonymize the profile" });
    }

    const { error: purgeError } = await admin.rpc("purge_user_personal_data", { target: userId });
    if (purgeError && !isMissingRelation(purgeError)) {
      return json(500, { error: "Could not remove personal content" });
    }

    await removeStorage(admin, userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json(500, { error: deleteError.message || "Could not delete the account" });
    }

    return json(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : MONEY_CHECK_FAILED;
    const status = message === PENDING_PAYOUT
      || message === PENDING_CREDIT
      || message === PENDING_HOLD
      || message === PENDING_STRIPE
      || message === STRIPE_UNKNOWN
      || message === STRIPE_SUBSCRIPTION
      || message === MONEY_CHECK_FAILED
      ? 409
      : httpStatusForError(error);
    return json(status, { error: message });
  }
});
