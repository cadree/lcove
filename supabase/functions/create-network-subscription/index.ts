import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-NETWORK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Platform fee percentage (20%)
const PLATFORM_FEE_PERCENT = 20;

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
    logStep("Network ID received", { networkId });

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get network details with owner info
    const { data: network, error: networkError } = await supabaseClient
      .from("networks")
      .select("*, stripe_connect_account_id, payout_enabled")
      .eq("id", networkId)
      .single();

    if (networkError || !network) throw new Error("Network not found");
    if (!network.is_paid) throw new Error("This network is free, no subscription required");
    if (!network.stripe_price_id) throw new Error("Network subscription not configured");
    logStep("Network found", { 
      name: network.name, 
      price: network.subscription_price,
      hasConnectAccount: !!network.stripe_connect_account_id,
      payoutEnabled: network.payout_enabled
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    logStep("Customer lookup", { customerId: customerId || "new" });

    // Build checkout session options
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: network.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/cinema/network/${networkId}?subscribed=true`,
      cancel_url: `${req.headers.get("origin")}/cinema/network/${networkId}`,
      metadata: {
        network_id: networkId,
        user_id: user.id,
      },
    };

    // If creator has Stripe Connect set up, add payment split
    // 80% goes to creator, 20% to platform
    if (network.stripe_connect_account_id && network.payout_enabled) {
      logStep("Adding revenue split", { 
        creatorAccount: network.stripe_connect_account_id,
        platformFee: `${PLATFORM_FEE_PERCENT}%` 
      });

      sessionOptions.subscription_data = {
        application_fee_percent: PLATFORM_FEE_PERCENT,
        transfer_data: {
          destination: network.stripe_connect_account_id,
        },
      };
    } else {
      logStep("No Connect account - all funds go to platform");
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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