import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { COMMUNITY_FUND_FEE_PERCENT } from "../_shared/fees.mjs";
import { destinationCharge, testStripe, verifiedDestination } from "../_shared/creator-connect.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { filmId } = await req.json();
    if (!filmId) return json({ error: "Film is required" }, 400);

    const { data: film, error } = await admin
      .from("profile_films")
      .select("id, title, owner_id, price_cents")
      .eq("id", filmId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!film) return json({ error: "Film not found" }, 404);
    if (film.owner_id === userData.user.id) return json({ error: "You already own this film" }, 400);
    if (!film.price_cents || film.price_cents <= 0) return json({ error: "This film is free" }, 400);

    const { data: unlocked } = await admin
      .from("profile_film_unlocks")
      .select("id")
      .eq("film_id", film.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (unlocked) return json({ already: true });

    const destination = await verifiedDestination(admin, film.owner_id);
    if (!destination) {
      return json({
        needs_connect: true,
        error: "This creator can't receive paid films until payouts are verified.",
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
          unit_amount: film.price_cents,
          product_data: { name: film.title },
        },
      }],
      success_url: `${origin}/profile/${film.owner_id}?film=unlocked`,
      cancel_url: `${origin}/profile/${film.owner_id}?film=cancel`,
      metadata: {
        type: "profile_film",
        film_id: film.id,
        buyer_id: userData.user.id,
        owner_id: film.owner_id,
        fee_percent: String(COMMUNITY_FUND_FEE_PERCENT),
      },
      payment_intent_data: destinationCharge(destination, film.price_cents),
    });

    return json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start checkout";
    return json({ error: message }, 400);
  }
});
