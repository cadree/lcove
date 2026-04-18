import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, stripe-signature",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MUSIC-PAYMENT][webhook] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    log("Missing STRIPE_WEBHOOK_SECRET");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    log("Signature verification failed", { err: String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    log("Event received", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      if (meta.type === "exclusive_track_purchase") {
        const trackId = meta.track_id;
        const buyerUserId = meta.buyer_user_id || session.client_reference_id;
        const accessRuleId = meta.access_rule_id || null;
        const amountCents = session.amount_total ?? 0;
        const paymentIntentId = session.payment_intent as string | null;

        // Try to update an existing pending row first
        const { data: existing } = await supabaseAdmin
          .from("exclusive_track_purchases")
          .select("id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("exclusive_track_purchases")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntentId,
              amount_cents: amountCents,
            })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin.from("exclusive_track_purchases").insert({
            track_id: trackId,
            buyer_user_id: buyerUserId,
            access_rule_id: accessRuleId || null,
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            amount_cents: amountCents,
            payment_status: "paid",
          });
        }
        log("Track purchase recorded", { trackId, buyerUserId });
      }

      if (meta.type === "artist_subscription") {
        const artistUserId = meta.artist_user_id;
        const subscriberUserId = meta.subscriber_user_id || session.client_reference_id;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;

        let currentPeriodEnd: string | null = null;
        let amountCents = 0;
        let interval = "monthly";
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          currentPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          amountCents = sub.items.data[0]?.price?.unit_amount ?? 0;
          interval = sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
        }

        const { data: existing } = await supabaseAdmin
          .from("artist_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("artist_subscriptions")
            .update({
              status: "active",
              current_period_end: currentPeriodEnd,
              stripe_customer_id: customerId,
              amount_cents: amountCents,
              interval,
            })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin.from("artist_subscriptions").insert({
            artist_user_id: artistUserId,
            subscriber_user_id: subscriberUserId,
            status: "active",
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            current_period_end: currentPeriodEnd,
            amount_cents: amountCents,
            interval,
          });
        }
        log("Subscription recorded", { artistUserId, subscriberUserId, subscriptionId });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("artist_subscriptions")
        .update({
          status: sub.status === "active" || sub.status === "trialing" ? "active" : "canceled",
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        })
        .eq("stripe_subscription_id", sub.id);
      log("Subscription updated", { subscriptionId: sub.id, status: sub.status });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Handler error", { msg });
    // Return 200 anyway to avoid retries on idempotent failures
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
