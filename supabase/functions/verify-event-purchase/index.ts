import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) => console.log(`[verify-event-purchase] ${step}${d ? " - " + JSON.stringify(d) : ""}`);

interface TicketOrder {
  id: string;
  payment_status: string | null;
  stripe_session_id: string | null;
  quantity: number | null;
  purchaser_user_id: string | null;
  event_id: string;
}

function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId, orderId, eventId } = await req.json();
    if (!sessionId && !orderId) {
      if (eventId) {
        return new Response(JSON.stringify({ freeRsvp: true, order: null, attendees: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("sessionId or orderId required");
    }

    // If we only got sessionId, look up the order
    let order: TicketOrder | null = null;
    if (orderId) {
      const { data } = await supabase.from("ticket_orders").select("*").eq("id", orderId).single();
      order = data as unknown as TicketOrder | null;
    } else {
      const { data } = await supabase.from("ticket_orders").select("*").eq("stripe_session_id", sessionId).single();
      order = data as unknown as TicketOrder | null;
    }
    if (!order) throw new Error("Order not found");

    const orderRecord = order as TicketOrder & { total_cents?: number | null; payment_method?: string | null };
    const isFreeOrder = orderRecord.payment_method === "free" || (orderRecord.total_cents ?? 0) === 0;

    // Free RSVPs are already confirmed. Do not ask Stripe.
    if (order.payment_status === "paid" || isFreeOrder) {
      if (order.payment_status !== "paid") {
        await supabase.from("ticket_orders").update({ payment_status: "paid" }).eq("id", order.id);
        order.payment_status = "paid";
      }
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
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const { error: confirmError } = await supabase.rpc("confirm_event_ticket_order", {
        p_order_id: order.id,
        p_payment_intent: paymentIntent,
      });
      if (confirmError) throw confirmError;
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
  } catch (error: unknown) {
    const msg = errorMessage(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(error),
    });
  }
});
