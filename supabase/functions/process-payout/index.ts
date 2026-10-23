import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ledgerBalances } from "../_shared/credit-balances.ts";
import { loadProfileConnect, syncPayoutEnabled, testStripe, withdrawalBlockedReason } from "../_shared/creator-connect.mjs";
import { PayoutRefusal, interpretPayoutRequest } from "../_shared/payout-request.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[PROCESS-PAYOUT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let legacyPayout = false;

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    const decision = interpretPayoutRequest(await req.json());
    if (!decision.ok) {
      return new Response(JSON.stringify({ success: false, error: decision.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: decision.status,
      });
    }
    legacyPayout = decision.legacy;
    const { amount, project_id, role_id } = decision;

    const stripe = testStripe();

    {
      const credits = await ledgerBalances(supabaseClient, user.id);
      const earnedBalance = credits.earned_balance;

      // Only server-issued earned credits from a verified source are withdrawable.
      // Transfers and client-minted rows are not, even if earned_balance includes them.
      const verifiedSources = ["event_ticket_sale", "store_order", "studio_booking", "stream_tip"];
      const { data: ledgerRows, error: ledgerReadError } = await supabaseClient
        .from("credit_ledger")
        .select("amount, earned_amount, credit_type, reference_type, verified_by, type, server_issued")
        .eq("user_id", user.id)
        .eq("credit_type", "earned");

      if (ledgerReadError) throw ledgerReadError;

      let verifiedIn = 0;
      let convertedOut = 0;
      for (const row of ledgerRows ?? []) {
        const earned = Number(row.earned_amount ?? row.amount ?? 0);
        if (row.type === "payout_conversion") {
          convertedOut += Math.abs(earned);
          continue;
        }
        const fromVerifiedSource = row.server_issued === true && (
          row.verified_by != null || verifiedSources.includes(row.reference_type)
        );
        if (fromVerifiedSource && earned > 0) verifiedIn += earned;
      }
      const withdrawable = Math.min(earnedBalance, Math.max(0, verifiedIn - convertedOut));

      if (withdrawable < amount) {
        throw new PayoutRefusal(`Insufficient verified Earned Credit. Withdrawable ${withdrawable} LC, need ${amount} LC. Only credits from verified sources can be withdrawn.`);
      }

      const profile = await loadProfileConnect(supabaseClient, user.id);
      if (!profile?.stripe_connect_account_id) {
        throw new PayoutRefusal("Set up payouts in Wallet before requesting a payout.");
      }
      const state = await syncPayoutEnabled(stripe, supabaseClient, user.id, profile.stripe_connect_account_id);
      const blocked = withdrawalBlockedReason(state);
      if (blocked) throw new PayoutRefusal(blocked);

      const { data: payout, error: payoutError } = await supabaseClient
        .from("payouts")
        .insert({
          user_id: user.id,
          amount,
          currency: "USD",
          status: "processing",
          project_id,
          role_id,
        })
        .select()
        .single();
      if (payoutError) throw payoutError;

      // 1 LC = $1. The 10% community-fund fee was already taken when the money was earned.
      let transfer;
      try {
        transfer = await stripe.transfers.create({
          amount: Math.round(Number(amount) * 100),
          currency: "usd",
          destination: profile.stripe_connect_account_id,
          metadata: { payout_id: payout.id, user_id: user.id, lc_per_usd: "1" },
        });
      } catch (transferError) {
        const message = transferError instanceof Error ? transferError.message : String(transferError);
        await supabaseClient.from("payouts").update({ status: "failed", error_message: message }).eq("id", payout.id);
        throw new PayoutRefusal(message);
      }

      const newTotalBalance = credits.balance - amount;
      const { error: ledgerError } = await supabaseClient.from("credit_ledger").insert({
        user_id: user.id,
        amount: -amount,
        balance_after: newTotalBalance,
        type: "payout_conversion",
        description: `Converted ${amount} Earned LC to a Stripe payout`,
        reference_type: project_id ? "project" : null,
        reference_id: project_id || null,
        credit_type: "earned",
        genesis_amount: 0,
        earned_amount: -amount,
      });
      if (ledgerError) {
        try {
          await stripe.transfers.createReversal(transfer.id);
        } catch (reversalError) {
          console.error("[PROCESS-PAYOUT] reversal failed", reversalError);
        }
        await supabaseClient.from("payouts").update({
          status: "failed",
          error_message: ledgerError.message,
          stripe_transfer_id: transfer.id,
        }).eq("id", payout.id);
        throw new Error(ledgerError.message);
      }

      await supabaseClient.from("payouts").update({
        status: "completed",
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
      }).eq("id", payout.id);

      logStep("Credit payout completed", { payoutId: payout.id, transferId: transfer.id });

      return new Response(JSON.stringify({
        success: true,
        payout_id: payout.id,
        stripe_transfer_id: transfer.id,
        type: "credit_conversion",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const soft = legacyPayout || error instanceof PayoutRefusal || (error instanceof Error && error.name === "PayoutRefusal");
    logStep("ERROR", { message: errorMessage, status: soft ? 200 : 500 });
    return new Response(JSON.stringify(soft ? { success: false, error: errorMessage } : { error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: soft ? 200 : 500,
    });
  }
});
