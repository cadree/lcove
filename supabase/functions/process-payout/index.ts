import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
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

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    const { amount, payout_method_id, project_id, role_id, use_credits } = await req.json();
    
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If using credits, convert from credit balance
    if (use_credits) {
      // Check user's EARNED credit balance - only earned credits can be paid out
      const { data: credits } = await supabaseClient
        .from('user_credits')
        .select('balance, earned_balance, genesis_balance')
        .eq('user_id', user.id)
        .single();

      const earnedBalance = Number(credits?.earned_balance || 0);

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
        throw new Error(`Insufficient verified Earned Credit. Withdrawable ${withdrawable} LC, need ${amount} LC. Only credits from verified sources can be withdrawn.`);
      }

      // Deduct from earned credits only
      const newEarnedBalance = earnedBalance - amount;
      const newTotalBalance = (credits?.balance || 0) - amount;
      
      await supabaseClient.from('credit_ledger').insert({
        user_id: user.id,
        amount: -amount,
        balance_after: newTotalBalance,
        type: 'payout_conversion',
        description: `Converted ${amount} Earned LC to payout`,
        reference_type: project_id ? 'project' : null,
        reference_id: project_id || null,
        credit_type: 'earned',
        genesis_amount: 0,
        earned_amount: -amount,
      });

      // Create payout record
      const { data: payout, error: payoutError } = await supabaseClient
        .from('payouts')
        .insert({
          user_id: user.id,
          amount,
          currency: 'USD',
          status: 'completed',
          project_id,
          role_id,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      logStep("Credit payout completed", { payoutId: payout.id });

      return new Response(JSON.stringify({ 
        success: true, 
        payout_id: payout.id,
        type: 'credit_conversion'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get payout method
    if (!payout_method_id) throw new Error("Payout method required");

    const { data: payoutMethod, error: methodError } = await supabaseClient
      .from('payout_methods')
      .select('*')
      .eq('id', payout_method_id)
      .eq('user_id', user.id)
      .single();

    if (methodError || !payoutMethod) throw new Error("Payout method not found");

    // Create Stripe transfer/payout
    let stripeTransferId = null;
    let stripePayoutId = null;

    // For bank accounts, create a payout
    if (payoutMethod.type === 'bank_account' && payoutMethod.stripe_bank_account_id) {
      // First need a connected account - this is simplified
      // In production, you'd use Stripe Connect
      logStep("Bank transfer requested", { amount });
    }

    // Create payout record
    const { data: payout, error: payoutError } = await supabaseClient
      .from('payouts')
      .insert({
        user_id: user.id,
        amount,
        currency: 'USD',
        status: 'processing',
        payout_method_id,
        stripe_transfer_id: stripeTransferId,
        stripe_payout_id: stripePayoutId,
        project_id,
        role_id,
      })
      .select()
      .single();

    if (payoutError) throw payoutError;

    // Create transaction record
    await supabaseClient.from('transactions').insert({
      user_id: user.id,
      type: 'payout',
      amount,
      currency: 'USD',
      status: 'processing',
      description: `Payout via ${payoutMethod.type}`,
      metadata: { payout_id: payout.id, project_id, role_id }
    });

    logStep("Payout created", { payoutId: payout.id });

    return new Response(JSON.stringify({ 
      success: true, 
      payout_id: payout.id,
      status: 'processing'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
