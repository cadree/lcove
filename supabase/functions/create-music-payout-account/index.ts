import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { assertStripeTestKey } from "../_shared/stripe-mode.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";
import { musicPayoutUrls } from "../_shared/payout-urls.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MUSIC-PAYMENT][onboard] ${step}${d}`);
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
    const { data: userData, error: uErr } = await supabaseClient.auth.getUser(token);
    if (uErr) throw new Error(`Auth: ${uErr.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Could not load your payout profile");

    const stripe = new Stripe(assertStripeTestKey(Deno.env.get("STRIPE_SECRET_KEY")), {
      apiVersion: "2025-08-27.basil",
    });

    let accountId = profile?.stripe_connect_account_id;

    if (!accountId) {
      log("Creating Connect account", { userId: user.id });
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { user_id: user.id, scope: "music" },
      });
      accountId = account.id;

      const { error: saveError } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("user_id", user.id);
      if (saveError) throw new Error("Could not save your payout account. Try again.");
    }

    const urls = musicPayoutUrls({
      origin: req.headers.get("origin"),
      siteUrl: Deno.env.get("SITE_URL"),
      appUrl: Deno.env.get("APP_URL"),
    });
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      ...urls,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url, accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(err),
    });
  }
});
