import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-EVENT-CONNECT-STATUS] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get user's profile with connect info
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("user_id, stripe_connect_account_id, payout_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    if (!profile.stripe_connect_account_id) {
      logStep("No Connect account found");
      return new Response(JSON.stringify({ 
        connected: false,
        accountId: null,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        pendingBalance: 0,
        availableBalance: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    logStep("Fetching Stripe account", { accountId: profile.stripe_connect_account_id });

    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
    
    // Get balance for the connected account
    let pendingBalance = 0;
    let availableBalance = 0;
    
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: profile.stripe_connect_account_id,
      });
      
      // Sum up all pending amounts (convert from cents)
      pendingBalance = balance.pending.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) / 100;
      availableBalance = balance.available.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) / 100;
      
      logStep("Balance retrieved", { pendingBalance, availableBalance });
    } catch (balanceError) {
      logStep("Could not retrieve balance", { error: String(balanceError) });
    }

    const isFullyOnboarded = account.charges_enabled && account.payouts_enabled;

    // Update payout_enabled in profile if status changed
    if (profile.payout_enabled !== isFullyOnboarded) {
      await supabaseClient
        .from("profiles")
        .update({ payout_enabled: isFullyOnboarded })
        .eq("user_id", user.id);
      logStep("Updated payout_enabled", { newValue: isFullyOnboarded });
    }

    logStep("Account status retrieved", { 
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });

    return new Response(JSON.stringify({ 
      connected: true,
      accountId: profile.stripe_connect_account_id,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      pendingBalance,
      availableBalance,
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
