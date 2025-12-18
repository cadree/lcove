import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-NETWORK-SUBSCRIPTION] ${step}${detailsStr}`);
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

    logStep("User authenticated", { userId: user.id });

    // Get network details
    const { data: network } = await supabaseClient
      .from("networks")
      .select("is_paid, owner_id, stripe_product_id")
      .eq("id", networkId)
      .single();

    if (!network) {
      return new Response(JSON.stringify({ subscribed: false, error: "Network not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Network owner always has access
    if (network.owner_id === user.id) {
      logStep("User is network owner");
      return new Response(JSON.stringify({ subscribed: true, isOwner: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Free networks are accessible to everyone
    if (!network.is_paid) {
      logStep("Network is free");
      return new Response(JSON.stringify({ subscribed: true, isFree: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check Stripe subscription
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
    });

    // Check if any subscription matches this network's product
    const hasActiveSub = subscriptions.data.some((sub: any) => 
      sub.items.data.some((item: any) => item.price.product === network.stripe_product_id)
    );

    logStep("Subscription check complete", { hasActiveSub });

    // Update local subscription record
    if (hasActiveSub) {
      const activeSub = subscriptions.data.find((sub: any) =>
        sub.items.data.some((item: any) => item.price.product === network.stripe_product_id)
      );
      
      if (activeSub) {
        await supabaseClient
          .from("network_subscriptions")
          .upsert({
            network_id: networkId,
            user_id: user.id,
            stripe_subscription_id: activeSub.id,
            status: "active",
            current_period_start: new Date(activeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(activeSub.current_period_end * 1000).toISOString(),
          }, { onConflict: "network_id,user_id" });
      }
    }

    return new Response(JSON.stringify({ 
      subscribed: hasActiveSub,
      subscription_end: hasActiveSub ? 
        new Date(subscriptions.data[0].current_period_end * 1000).toISOString() : null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage, subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
