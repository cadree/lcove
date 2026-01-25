import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-STORE-CONNECT] ${step}${detailsStr}`);
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

    const { storeId } = await req.json();
    if (!storeId) throw new Error("Store ID is required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get store with connect account
    const { data: store, error: storeError } = await supabaseClient
      .from("stores")
      .select("id, user_id, stripe_connect_account_id, payout_enabled")
      .eq("id", storeId)
      .single();

    if (storeError || !store) throw new Error("Store not found");
    if (store.user_id !== user.id) throw new Error("You don't own this store");

    if (!store.stripe_connect_account_id) {
      logStep("No Connect account found");
      return new Response(JSON.stringify({ 
        hasAccount: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the account status
    const account = await stripe.accounts.retrieve(store.stripe_connect_account_id);
    logStep("Account retrieved", { 
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    });

    // Update payout_enabled status in database
    const shouldBeEnabled = account.charges_enabled && account.payouts_enabled && account.details_submitted;
    if (store.payout_enabled !== shouldBeEnabled) {
      await supabaseClient
        .from("stores")
        .update({ payout_enabled: shouldBeEnabled })
        .eq("id", storeId);
      logStep("Updated payout_enabled status", { payout_enabled: shouldBeEnabled });
    }

    return new Response(JSON.stringify({
      hasAccount: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
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
