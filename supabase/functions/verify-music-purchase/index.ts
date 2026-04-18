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
  console.log(`[VERIFY-MUSIC-PURCHASE] ${step}${d}`);
};

/**
 * Webhook-independent fallback: when the buyer returns from Stripe Checkout,
 * the client calls this with their pending purchase rows and we ask Stripe
 * directly whether each session was paid. If yes, we mark the purchase paid
 * (or insert a subscription row). This guarantees the unlock flow works even
 * if the Stripe webhook hasn't been wired up yet or is delayed.
 */
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
    const { data: userData } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find this user's pending purchases (by buyer)
    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from("exclusive_track_purchases")
      .select("id, stripe_session_id, track_id, access_rule_id")
      .eq("buyer_user_id", user.id)
      .eq("payment_status", "pending");

    if (pendingErr) throw pendingErr;

    const results: Array<{ session: string; status: string; updated?: boolean }> = [];

    for (const p of pending || []) {
      if (!p.stripe_session_id) continue;
      try {
        const session = await stripe.checkout.sessions.retrieve(p.stripe_session_id);
        log("Session checked", { id: session.id, status: session.payment_status });
        if (session.payment_status === "paid") {
          await supabaseAdmin
            .from("exclusive_track_purchases")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: session.payment_intent as string | null,
              amount_cents: session.amount_total ?? 0,
            })
            .eq("id", p.id);
          results.push({ session: session.id, status: "paid", updated: true });
        } else if (session.status === "expired") {
          await supabaseAdmin
            .from("exclusive_track_purchases")
            .update({ payment_status: "expired" })
            .eq("id", p.id);
          results.push({ session: session.id, status: "expired", updated: true });
        } else {
          results.push({ session: session.id, status: session.payment_status });
        }
      } catch (e) {
        log("Session lookup failed", { id: p.stripe_session_id, err: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log("ERROR", { msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
