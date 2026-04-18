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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", user.id)
      .single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
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

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("user_id", user.id);
    }

    const origin = req.headers.get("origin") || "";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/profile?music_payouts=refresh`,
      return_url: `${origin}/profile?music_payouts=success`,
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
      status: 400,
    });
  }
});
