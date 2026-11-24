import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Authentication failed");

    const { orderId } = await req.json();
    if (!orderId) throw new Error("Missing orderId");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("store_orders")
      .select("id, store_id, payment_type, status, stripe_payment_intent_id, seller_payout_status")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("Order not found");

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, user_id")
      .eq("id", order.store_id)
      .single();
    if (storeError || !store || store.user_id !== user.id) {
      throw new Error("You don't own this order");
    }
    if (order.payment_type !== "cash") throw new Error("Only card orders can be refunded here");
    if (order.status === "refunded") {
      return new Response(JSON.stringify({ refunded: true, already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!order.stripe_payment_intent_id) throw new Error("This order has no card payment");
    if (order.status !== "confirmed" && order.status !== "completed") {
      throw new Error("Only a paid order can be refunded");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const connected = order.seller_payout_status === "processing" || order.seller_payout_status === "completed";
    await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      reverse_transfer: connected,
      refund_application_fee: connected,
    }, {
      idempotencyKey: `store-refund-${order.id}`,
    });

    const { error: markError } = await supabaseAdmin.rpc("mark_store_order_refunded", {
      p_payment_intent: order.stripe_payment_intent_id,
    });
    if (markError) throw new Error(markError.message);

    return new Response(JSON.stringify({ refunded: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(error),
    });
  }
});
