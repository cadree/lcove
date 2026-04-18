import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MUSIC-PAYMENT][subscribe] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { artist_user_id, access_rule_id } = await req.json();
    if (!artist_user_id || !access_rule_id) throw new Error("Missing required fields");

    if (user.id === artist_user_id) {
      throw new Error("You can't subscribe to yourself");
    }

    const { data: artistProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, payout_enabled, display_name")
      .eq("user_id", artist_user_id)
      .single();

    if (profileErr) throw new Error("Could not load artist profile");

    if (!artistProfile?.stripe_connect_account_id || !artistProfile?.payout_enabled) {
      throw new Error("This artist has not enabled payouts yet.");
    }

    const { data: rule, error: ruleErr } = await supabaseAdmin
      .from("exclusive_access_rules")
      .select("*")
      .eq("id", access_rule_id)
      .single();

    if (ruleErr || !rule || rule.rule_type !== "subscription") {
      throw new Error("Invalid subscription rule");
    }

    if (!rule.amount_cents || rule.amount_cents <= 0) {
      throw new Error("Subscription price must be greater than zero");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const interval = rule.interval === "yearly" ? "year" : "month";
    const origin = req.headers.get("origin") || "";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${artistProfile.display_name || "Artist"} - Exclusive Access`,
              description: rule.label || `${interval === "year" ? "Yearly" : "Monthly"} subscription`,
            },
            unit_amount: rule.amount_cents,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        application_fee_percent: 0,
        transfer_data: {
          destination: artistProfile.stripe_connect_account_id,
        },
        metadata: {
          type: "artist_subscription",
          artist_user_id,
          subscriber_user_id: user.id,
          access_rule_id,
        },
      },
      metadata: {
        type: "artist_subscription",
        artist_user_id,
        subscriber_user_id: user.id,
        access_rule_id,
      },
      success_url: `${origin}/profile/${artist_user_id}?subscribed=true`,
      cancel_url: `${origin}/profile/${artist_user_id}?subscribed=canceled`,
    });

    log("Subscription checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
