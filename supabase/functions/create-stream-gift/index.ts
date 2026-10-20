import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { COMMUNITY_FUND_FEE_PERCENT } from "../_shared/fees.mjs";
import { destinationCharge, testStripe, verifiedDestination } from "../_shared/creator-connect.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GIFTS = {
  rose: { cents: 100, name: "Rose" },
  star: { cents: 500, name: "Star" },
  crown: { cents: 1000, name: "Crown" },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);

    const { streamId, gift } = await req.json();
    const chosen = GIFTS[gift];
    if (!streamId || !chosen) return json({ error: "Choose a rose, star, or crown" }, 400);

    const { data: stream, error } = await admin
      .from("live_streams")
      .select("id, title, host_id")
      .eq("id", streamId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!stream) return json({ error: "Stream not found" }, 404);
    if (stream.host_id === userData.user.id) return json({ error: "You can't gift your own stream" }, 400);

    const destination = await verifiedDestination(admin, stream.host_id);
    if (!destination) {
      return json({
        needs_connect: true,
        error: "This host can't receive card gifts until payouts are verified. LC tips still work.",
      });
    }

    const stripe = testStripe();
    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userData.user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: chosen.cents,
          product_data: { name: `${chosen.name} for ${stream.title || "a live stream"}` },
        },
      }],
      success_url: `${origin}/live?gift=success`,
      cancel_url: `${origin}/live?gift=cancel`,
      metadata: {
        type: "stream_gift",
        stream_id: stream.id,
        host_id: stream.host_id,
        sender_id: userData.user.id,
        gift,
        fee_percent: String(COMMUNITY_FUND_FEE_PERCENT),
      },
      payment_intent_data: destinationCharge(destination, chosen.cents),
    });

    return json({ url: session.url, fee_percent: COMMUNITY_FUND_FEE_PERCENT, amount_cents: chosen.cents });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
