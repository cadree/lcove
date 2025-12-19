import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
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

    const { networkId } = await req.json();
    if (!networkId) throw new Error("Network ID is required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Verify user owns this network
    const { data: network, error: networkError } = await supabaseClient
      .from("networks")
      .select("id, owner_id, name, stripe_connect_account_id")
      .eq("id", networkId)
      .single();

    if (networkError || !network) throw new Error("Network not found");
    if (network.owner_id !== user.id) throw new Error("You don't own this network");
    logStep("Network verified", { networkId, networkName: network.name });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let accountId = network.stripe_connect_account_id;

    // Create a new Connect account if one doesn't exist
    if (!accountId) {
      logStep("Creating new Connect account");
      
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          network_id: networkId,
          user_id: user.id,
        },
      });

      accountId = account.id;
      logStep("Connect account created", { accountId });

      // Save the account ID to the network
      const { error: updateError } = await supabaseClient
        .from("networks")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", networkId);

      if (updateError) {
        logStep("Failed to save account ID", { error: updateError.message });
      }
    } else {
      logStep("Using existing Connect account", { accountId });
    }

    // Create an account link for onboarding
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/cinema/manage/${networkId}?connect_refresh=true`,
      return_url: `${origin}/cinema/manage/${networkId}?connect_success=true`,
      type: "account_onboarding",
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      accountId 
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