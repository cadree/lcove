import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: any) => console.log(`[verify-event-purchase] ${step}${d ? " - " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId, orderId } = await req.json();
    if (!sessionId && !orderId) throw new Error("sessionId or orderId required");

    // If we only got sessionId, look up the order
    let order: any = null;
    if (orderId) {
      const { data } = await supabase.from("ticket_orders").select("*").eq("id", orderId).single();
      order = data;
    } else {
      const { data } = await supabase.from("ticket_orders").select("*").eq("stripe_session_id", sessionId).single();
      order = data;
    }
    if (!order) throw new Error("Order not found");

    // If already paid (free order or webhook updated), return immediately
    if (order.payment_status === "paid") {
      const { data: attendees } = await supabase
        .from("event_attendees")
        .select("id, qr_code, ticket_number, attendee_name, attendee_email, status")
        .eq("order_id", order.id)
        .order("created_at");
      return new Response(JSON.stringify({ order, attendees: attendees || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise: verify with Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.retrieve(sessionId || order.stripe_session_id);
    log("Session", { status: session.payment_status });

    if (session.payment_status === "paid") {
      // Mark order paid
      await supabase
        .from("ticket_orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("id", order.id);

      // Bump tier sold count (best-effort)
      const { data: oneAttendee } = await supabase
        .from("event_attendees")
        .select("tier_id")
        .eq("order_id", order.id)
        .limit(1)
        .maybeSingle();
      if (oneAttendee?.tier_id) {
        const { data: tier } = await supabase.from("ticket_tiers").select("quantity_sold").eq("id", oneAttendee.tier_id).single();
        if (tier) {
          await supabase
            .from("ticket_tiers")
            .update({ quantity_sold: (tier.quantity_sold || 0) + order.quantity })
            .eq("id", oneAttendee.tier_id);
        }
      }

      // Legacy RSVP (best effort)
      if (order.purchaser_user_id) {
        await supabase.from("event_rsvps").upsert({
          event_id: order.event_id,
          user_id: order.purchaser_user_id,
          status: "going",
          ticket_purchased: true,
          stripe_payment_id: session.id,
        }, { onConflict: "event_id,user_id" });
      }
    }

    const { data: refreshedOrder } = await supabase.from("ticket_orders").select("*").eq("id", order.id).single();
    const { data: attendees } = await supabase
      .from("event_attendees")
      .select("id, qr_code, ticket_number, attendee_name, attendee_email, status")
      .eq("order_id", order.id)
      .order("created_at");

    return new Response(JSON.stringify({ order: refreshedOrder, attendees: attendees || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("ERROR", { msg: error?.message });
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
