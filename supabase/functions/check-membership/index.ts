import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEMBERSHIP_PRODUCTS = {
  "prod_TcmECcqnCALhUv": "community",
  "prod_TcmEthbJUKGwjv": "elite",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-MEMBERSHIP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null,
        monthly_amount: null,
        lifetime_contribution: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    // Find membership subscription
    let membershipSub: Stripe.Subscription | null = null;
    let tier: string | null = null;
    let monthlyAmount = 0;

    for (const sub of subscriptions.data) {
      const productId = sub.items.data[0]?.price?.product as string;
      if (productId && MEMBERSHIP_PRODUCTS[productId as keyof typeof MEMBERSHIP_PRODUCTS]) {
        membershipSub = sub;
        tier = MEMBERSHIP_PRODUCTS[productId as keyof typeof MEMBERSHIP_PRODUCTS];
        monthlyAmount = (sub.items.data[0]?.price?.unit_amount || 0) / 100;
        break;
      }
    }

    if (!membershipSub) {
      logStep("No active membership subscription found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null,
        monthly_amount: null,
        lifetime_contribution: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscriptionEnd = new Date(membershipSub.current_period_end * 1000).toISOString();
    logStep("Active membership found", { tier, subscriptionEnd, monthlyAmount });

    // Calculate lifetime contribution from invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: "paid",
      limit: 100,
    });

    let lifetimeContribution = 0;
    for (const invoice of invoices.data) {
      // Only count membership invoices
      if (invoice.subscription === membershipSub.id) {
        lifetimeContribution += (invoice.amount_paid || 0) / 100;
      }
    }

    // Upsert membership record in database
    const { error: upsertError } = await supabaseClient
      .from("memberships")
      .upsert({
        user_id: user.id,
        tier,
        status: membershipSub.status,
        stripe_customer_id: customerId,
        stripe_subscription_id: membershipSub.id,
        current_period_start: new Date(membershipSub.current_period_start * 1000).toISOString(),
        current_period_end: subscriptionEnd,
        monthly_amount: monthlyAmount,
        lifetime_contribution: lifetimeContribution,
        grant_eligible: lifetimeContribution >= 50 || tier === "elite",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      logStep("Error upserting membership", { error: upsertError.message });
    }

    return new Response(JSON.stringify({
      subscribed: true,
      tier,
      subscription_end: subscriptionEnd,
      monthly_amount: monthlyAmount,
      lifetime_contribution: lifetimeContribution,
      grant_eligible: lifetimeContribution >= 50 || tier === "elite",
      stripe_subscription_id: membershipSub.id,
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
