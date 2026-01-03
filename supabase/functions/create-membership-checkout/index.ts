import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TierConfig {
  product_id: string;
  price_id: string;
  name: string;
  min_amount?: number;
  amount?: number;
}

// Membership tiers configuration
const MEMBERSHIP_TIERS: Record<string, TierConfig> = {
  community: {
    product_id: "prod_Tiqd9bhgTKWRRo",
    price_id: "price_1SlOwh2O6q4dMrYLAwRO57NB",
    name: "Community Member",
    min_amount: 500, // $5 minimum in cents
  },
  elite: {
    product_id: "prod_TiqeFdKIv2xWou",
    price_id: "price_1SlOwv2O6q4dMrYLVppF6w4f",
    name: "Elite Member",
    amount: 2500, // $25 fixed in cents
  },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-MEMBERSHIP-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tier, customAmount } = await req.json();
    logStep("Request params", { tier, customAmount });

    if (!tier || !MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS]) {
      throw new Error("Invalid membership tier");
    }

    const tierConfig = MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS];
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if user already has a Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    let sessionConfig: Stripe.Checkout.SessionCreateParams;

    if (tier === "community") {
      // Pay-what-you-can with custom amount
      const minAmount = tierConfig.min_amount || 500;
      const amount = customAmount ? Math.max(customAmount * 100, minAmount) : minAmount;
      
      sessionConfig = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product: tierConfig.product_id,
              unit_amount: amount,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${origin}/membership?success=true&tier=${tier}`,
        cancel_url: `${origin}/membership?cancelled=true`,
        metadata: {
          user_id: user.id,
          tier: tier,
          amount: amount.toString(),
        },
      };
    } else {
      // Elite membership with fixed price
      sessionConfig = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price: tierConfig.price_id,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${origin}/membership?success=true&tier=${tier}`,
        cancel_url: `${origin}/membership?cancelled=true`,
        metadata: {
          user_id: user.id,
          tier: tier,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
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
