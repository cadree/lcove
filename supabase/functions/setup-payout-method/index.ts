import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SETUP-PAYOUT-METHOD] ${step}`, details ? JSON.stringify(details) : '');
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
    if (!user?.email) throw new Error("User not authenticated");

    const { type, return_url } = await req.json();
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
    }

    logStep("Customer found/created", { customerId });

    // Sync existing payment methods from Stripe
    if (type === 'sync') {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      for (const pm of paymentMethods.data) {
        // Check if method already exists
        const { data: existing } = await supabaseClient
          .from('payout_methods')
          .select('id')
          .eq('stripe_payment_method_id', pm.id)
          .single();

        if (!existing) {
          const isFirst = paymentMethods.data.indexOf(pm) === 0;
          const { error } = await supabaseClient.from('payout_methods').insert({
            user_id: user.id,
            type: 'debit_card',
            stripe_payment_method_id: pm.id,
            last_four: pm.card?.last4,
            brand: pm.card?.brand,
            is_default: isFirst,
          });
          if (error) logStep("Error syncing payment method", error);
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        synced: paymentMethods.data.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (type === 'setup_intent') {
      // Create a SetupIntent for adding payment methods
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      return new Response(JSON.stringify({ 
        client_secret: setupIntent.client_secret,
        customer_id: customerId
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (type === 'checkout_setup') {
      // Create a checkout session for setup mode
      const origin = req.headers.get("origin") || return_url || "http://localhost:3000";
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${origin}/wallet?setup=success`,
        cancel_url: `${origin}/wallet?setup=cancelled`,
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // List existing payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Sync payment methods to database
    for (const pm of paymentMethods.data) {
      const { error } = await supabaseClient.from('payout_methods').upsert({
        user_id: user.id,
        type: 'debit_card',
        stripe_payment_method_id: pm.id,
        last_four: pm.card?.last4,
        brand: pm.card?.brand,
      }, {
        onConflict: 'stripe_payment_method_id'
      });

      if (error) logStep("Error syncing payment method", error);
    }

    return new Response(JSON.stringify({ 
      success: true,
      payment_methods: paymentMethods.data.map((pm: any) => ({
        id: pm.id,
        type: pm.type,
        last_four: pm.card?.last4,
        brand: pm.card?.brand,
      }))
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
