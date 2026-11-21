import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  createSupabaseStripeDb,
  handleSignedStripeWebhook,
} from "../_shared/stripe-webhook-dispatch.mjs";
import { assertStripeTestKey } from "../_shared/stripe-mode.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let stripeKey = "";
  try {
    stripeKey = assertStripeTestKey(Deno.env.get("STRIPE_SECRET_KEY"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe test key required";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(error),
    });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-08-27.basil",
  });
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const result = await handleSignedStripeWebhook({
    rawBody: await req.text(),
    signature: req.headers.get("stripe-signature"),
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET"),
    stripe,
    db: createSupabaseStripeDb(supabaseAdmin, stripe),
  });

  return new Response(JSON.stringify(result.body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: result.status,
  });
});
