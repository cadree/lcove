import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { artist_user_id, access_rule_id } = await req.json();
    if (!artist_user_id || !access_rule_id) throw new Error("Missing required fields");

    // Get artist's Connect account
    const { data: artistProfile } = await supabaseAdmin
      .from("profiles")
      .select("connect_account_id, display_name")
      .eq("user_id", artist_user_id)
      .single();

    if (!artistProfile?.connect_account_id) {
      throw new Error("Artist has not set up payments yet");
    }

    // Get the access rule
    const { data: rule } = await supabaseAdmin
      .from("exclusive_access_rules")
      .select("*")
      .eq("id", access_rule_id)
      .single();

    if (!rule || rule.rule_type !== "subscription") {
      throw new Error("Invalid subscription rule");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const interval = rule.interval === "yearly" ? "year" : "month";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${artistProfile.display_name || "Artist"} - Exclusive Access`,
              description: rule.label || "Monthly subscription for exclusive content",
            },
            unit_amount: rule.amount_cents,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        transfer_data: {
          destination: artistProfile.connect_account_id,
        },
        metadata: {
          artist_user_id,
          subscriber_user_id: user.id,
          access_rule_id,
          type: "artist_subscription",
        },
      },
      metadata: {
        artist_user_id,
        subscriber_user_id: user.id,
        type: "artist_subscription",
      },
      success_url: `${req.headers.get("origin")}/profile/${artist_user_id}?subscribed=true`,
      cancel_url: `${req.headers.get("origin")}/profile/${artist_user_id}`,
    });

    // Record subscription (pending)
    await supabaseAdmin.from("artist_subscriptions").insert({
      artist_user_id,
      subscriber_user_id: user.id,
      status: "active",
      amount_cents: rule.amount_cents,
      interval: rule.interval || "monthly",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
