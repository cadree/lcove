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
  console.log(`[MUSIC-PAYMENT][purchase] ${step}${d}`);
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

    const { track_id, access_rule_id, artist_user_id } = await req.json();
    if (!track_id || !artist_user_id) throw new Error("Missing required fields");

    if (user.id === artist_user_id) {
      throw new Error("You can't purchase your own track");
    }

    // Get artist's Stripe Connect account + payout status
    const { data: artistProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, payout_enabled, display_name")
      .eq("user_id", artist_user_id)
      .single();

    if (profileErr) {
      log("Profile lookup error", { profileErr });
      throw new Error("Could not load artist profile");
    }

    if (!artistProfile?.stripe_connect_account_id || !artistProfile?.payout_enabled) {
      log("Artist payout not ready", {
        hasAccount: !!artistProfile?.stripe_connect_account_id,
        payoutEnabled: artistProfile?.payout_enabled,
      });
      throw new Error("This artist has not enabled payouts yet.");
    }

    // Get track and rule info
    const { data: track, error: trackErr } = await supabaseAdmin
      .from("exclusive_tracks")
      .select("*")
      .eq("id", track_id)
      .single();

    if (trackErr || !track) throw new Error("Track not found");

    let amountCents = track.price_cents || 0;
    if (access_rule_id) {
      const { data: rule } = await supabaseAdmin
        .from("exclusive_access_rules")
        .select("*")
        .eq("id", access_rule_id)
        .single();
      if (rule?.amount_cents) amountCents = rule.amount_cents;
    }

    if (amountCents <= 0) {
      throw new Error("This track is free — use the Fan Challenge to unlock it.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find/create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "";

    // Destination charge: 100% to artist, 0% platform fee
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: track.title,
              description: `Exclusive track by ${artistProfile.display_name || "artist"}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: {
          destination: artistProfile.stripe_connect_account_id,
        },
      },
      metadata: {
        type: "exclusive_track_purchase",
        track_id,
        buyer_user_id: user.id,
        artist_user_id,
        access_rule_id: access_rule_id || "",
      },
      success_url: `${origin}/profile/${artist_user_id}?purchase=success`,
      cancel_url: `${origin}/profile/${artist_user_id}?purchase=canceled`,
    });

    log("Checkout session created", { sessionId: session.id, amountCents });

    // Insert pending purchase row keyed on stripe_session_id (idempotent via unique index)
    const { error: insertErr } = await supabaseAdmin
      .from("exclusive_track_purchases")
      .insert({
        track_id,
        buyer_user_id: user.id,
        access_rule_id: access_rule_id || null,
        amount_cents: amountCents,
        stripe_session_id: session.id,
        payment_status: "pending",
      });
    if (insertErr) log("Pending insert warning", { insertErr });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log("ERROR", { msg });
    // Return 200 with structured error so the client can read the body cleanly
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
