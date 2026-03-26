import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-FUND-DONATION] ${step}${detailsStr}`);
};

// Reuse the community product for recurring; one-time uses price_data
const COMMUNITY_PRODUCT_ID = "prod_Tiqd9bhgTKWRRo";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { amount, mode, email: guestEmail } = await req.json();
    // amount is in dollars (number), mode is "one_time" or "recurring"
    if (!amount || amount < 1) throw new Error("Minimum donation is $1");
    if (!mode || !["one_time", "recurring"].includes(mode))
      throw new Error("Invalid mode");

    const amountCents = Math.round(amount * 100);
    logStep("Params", { amountCents, mode, guestEmail });

    // Try to get authenticated user (optional)
    let userEmail: string | undefined;
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? ""
        );
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        if (data.user?.email) {
          userEmail = data.user.email;
          userId = data.user.id;
          logStep("Authenticated user", { userId, userEmail });
        }
      } catch {
        logStep("Auth check failed, proceeding as guest");
      }
    }

    // For guests, use provided email (optional – Stripe will collect if missing)
    const customerEmail = userEmail || guestEmail || undefined;

    // Look up existing Stripe customer
    let customerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "https://lcove.lovable.app";

    let sessionConfig: Stripe.Checkout.SessionCreateParams;

    if (mode === "recurring") {
      sessionConfig = {
        customer: customerId,
        customer_email: customerId ? undefined : customerEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product: COMMUNITY_PRODUCT_ID,
              unit_amount: amountCents,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${origin}/fund?donated=true`,
        cancel_url: `${origin}/fund?cancelled=true`,
        metadata: {
          source: "fund_donation",
          user_id: userId || "guest",
        },
      };
    } else {
      sessionConfig = {
        customer: customerId,
        customer_email: customerId ? undefined : customerEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product: COMMUNITY_PRODUCT_ID,
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/fund?donated=true`,
        cancel_url: `${origin}/fund?cancelled=true`,
        metadata: {
          source: "fund_donation",
          user_id: userId || "guest",
        },
      };
    }

    // If no email at all, let Stripe collect it
    if (!customerEmail && !customerId) {
      delete sessionConfig.customer_email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Session created", { sessionId: session.id, mode });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
