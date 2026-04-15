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
    // Auth
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { track_id, access_rule_id, artist_user_id } = await req.json();
    if (!track_id || !artist_user_id) throw new Error("Missing required fields");

    // Get artist's Stripe Connect account
    const { data: artistProfile } = await supabaseAdmin
      .from("profiles")
      .select("connect_account_id")
      .eq("user_id", artist_user_id)
      .single();

    if (!artistProfile?.connect_account_id) {
      throw new Error("Artist has not set up payments yet");
    }

    // Get track and rule info
    const { data: track } = await supabaseAdmin
      .from("exclusive_tracks")
      .select("*")
      .eq("id", track_id)
      .single();

    if (!track) throw new Error("Track not found");

    let amountCents = track.price_cents || 0;
    if (access_rule_id) {
      const { data: rule } = await supabaseAdmin
        .from("exclusive_access_rules")
        .select("*")
        .eq("id", access_rule_id)
        .single();
      if (rule?.amount_cents) amountCents = rule.amount_cents;
    }

    if (amountCents <= 0) throw new Error("Invalid price");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    // 100% to artist via transfer_data
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: track.title,
              description: `Exclusive track by artist`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        transfer_data: {
          destination: artistProfile.connect_account_id,
        },
      },
      metadata: {
        track_id,
        buyer_user_id: user.id,
        access_rule_id: access_rule_id || "",
        type: "exclusive_track_purchase",
      },
      success_url: `${req.headers.get("origin")}/profile/${artist_user_id}?purchase=success`,
      cancel_url: `${req.headers.get("origin")}/profile/${artist_user_id}`,
    });

    // Record purchase (pending — ideally verify via webhook but for MVP record on checkout creation)
    await supabaseAdmin.from("exclusive_track_purchases").insert({
      track_id,
      buyer_user_id: user.id,
      access_rule_id: access_rule_id || null,
      stripe_payment_intent_id: session.payment_intent as string,
      amount_cents: amountCents,
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
