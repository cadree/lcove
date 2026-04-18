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
  console.log(`[VERIFY-ARTIST-SUBSCRIPTION] ${step}${d}`);
};

/**
 * Webhook-independent fallback for artist subscriptions. When a buyer returns
 * from Stripe with ?subscribed=true, the client calls this. We look up the
 * subscriber's recent Stripe customer + subscriptions and upsert active rows
 * into artist_subscriptions for any artist they're now paying.
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
    if (!user?.email) throw new Error("Not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find this user's Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ ok: true, checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const customerId = customers.data[0].id;

    // List recent active subs (any status) — we only care about active/trialing here
    const subs = await stripe.subscriptions.list({ customer: customerId, limit: 20, status: "all" });
    let upserts = 0;

    for (const sub of subs.data) {
      const meta = sub.metadata || {};
      if (meta.type !== "artist_subscription") continue;
      const artistUserId = meta.artist_user_id;
      const subscriberUserId = meta.subscriber_user_id || user.id;
      if (!artistUserId) continue;

      const isActive = sub.status === "active" || sub.status === "trialing";
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
      const amountCents = sub.items.data[0]?.price?.unit_amount ?? 0;
      const interval =
        sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";

      const { data: existing } = await supabaseAdmin
        .from("artist_subscriptions")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("artist_subscriptions")
          .update({
            status: isActive ? "active" : "canceled",
            current_period_end: periodEnd,
            amount_cents: amountCents,
            interval,
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("artist_subscriptions").insert({
          artist_user_id: artistUserId,
          subscriber_user_id: subscriberUserId,
          status: isActive ? "active" : "canceled",
          stripe_subscription_id: sub.id,
          stripe_customer_id: customerId,
          current_period_end: periodEnd,
          amount_cents: amountCents,
          interval,
        });
      }
      upserts++;
      log("Upserted subscription", { sub: sub.id, status: sub.status });
    }

    return new Response(JSON.stringify({ ok: true, checked: subs.data.length, upserts }), {
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
