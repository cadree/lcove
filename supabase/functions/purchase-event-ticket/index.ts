import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[purchase-event-ticket] ${step}${d}`);
};

interface AttendeeInput {
  name: string;
  email?: string;
  phone?: string;
  social?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth (optional — guests allowed)
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email ?? null;
      }
    }

    const body = await req.json();
    const {
      eventId,
      tierId, // optional — if missing, use default tier
      attendees, // optional array; if missing falls back to single legacy purchase
      // legacy single-ticket fields (still supported)
      quantity: legacyQty,
      guestName,
      guestEmail,
      guestPhone,
    } = body;

    if (!eventId) throw new Error("eventId is required");

    // Build attendee list
    let attendeeList: AttendeeInput[] = [];
    if (Array.isArray(attendees) && attendees.length > 0) {
      attendeeList = attendees.map((a: any) => ({
        name: String(a.name || "").trim(),
        email: a.email ? String(a.email).trim().toLowerCase() : undefined,
        phone: a.phone ? String(a.phone).trim() : undefined,
        social: a.social ? String(a.social).trim().replace(/^@/, "") : undefined,
      })).filter(a => a.name);
    } else {
      // legacy: build a single attendee from purchaser info
      const qty = Math.max(1, Number(legacyQty || 1));
      const purchaserName = (guestName || userEmail || "Guest").toString().trim();
      const purchaserEmail = (guestEmail || userEmail || "").toString().trim().toLowerCase() || undefined;
      const purchaserPhone = guestPhone ? String(guestPhone).trim() : undefined;
      attendeeList = Array.from({ length: qty }, (_, i) => ({
        name: i === 0 ? purchaserName : `${purchaserName} (Guest ${i + 1})`,
        email: i === 0 ? purchaserEmail : undefined,
        phone: i === 0 ? purchaserPhone : undefined,
      }));
    }

    if (attendeeList.length === 0) throw new Error("At least one attendee required");
    if (attendeeList.length > 20) throw new Error("Maximum 20 tickets per order");

    // Fetch event
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, title, creator_id, ticket_price, capacity")
      .eq("id", eventId)
      .single();
    if (eventErr || !event) throw new Error("Event not found");

    // Resolve tier
    let tier: any = null;
    if (tierId) {
      const { data } = await supabase
        .from("ticket_tiers")
        .select("*")
        .eq("id", tierId)
        .eq("event_id", eventId)
        .single();
      tier = data;
    }
    if (!tier) {
      // fallback: default tier (sort_order 0) or any active
      const { data } = await supabase
        .from("ticket_tiers")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      tier = data;
    }
    if (!tier) throw new Error("No active ticket tier available for this event");

    // Capacity check
    if (tier.capacity != null) {
      const remaining = tier.capacity - (tier.quantity_sold || 0);
      if (remaining < attendeeList.length) {
        throw new Error(`Only ${Math.max(0, remaining)} ticket(s) remaining for this tier`);
      }
    }

    const unitCents = tier.price_cents || 0;
    const totalCents = unitCents * attendeeList.length;
    const isFree = unitCents === 0;
    const purchaserEmail = userEmail || attendeeList[0].email || guestEmail || null;
    const purchaserName = attendeeList[0].name || guestName || null;
    const purchaserPhone = attendeeList[0].phone || guestPhone || null;
    const purchaserSocial = attendeeList[0].social || null;

    log("Resolved", { tier: tier.id, qty: attendeeList.length, totalCents, isFree });

    // ---- FREE PATH ----
    if (isFree) {
      const { data: order, error: orderErr } = await supabase
        .from("ticket_orders")
        .insert({
          event_id: eventId,
          purchaser_user_id: userId,
          purchaser_name: purchaserName,
          purchaser_email: purchaserEmail,
          purchaser_phone: purchaserPhone,
          purchaser_social: purchaserSocial,
          quantity: attendeeList.length,
          subtotal_cents: 0,
          total_cents: 0,
          currency: tier.currency,
          payment_method: "free",
          payment_status: "paid",
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const attendeeRows = attendeeList.map(a => ({
        event_id: eventId,
        order_id: order.id,
        tier_id: tier.id,
        attendee_user_id: userId,
        attendee_name: a.name,
        attendee_email: a.email || purchaserEmail,
        attendee_phone: a.phone,
        attendee_social: a.social,
        status: "registered",
      }));
      const { data: insertedAttendees, error: attErr } = await supabase
        .from("event_attendees")
        .insert(attendeeRows)
        .select("id, qr_code, ticket_number, attendee_name");
      if (attErr) throw attErr;

      // Update tier sold count
      await supabase.from("ticket_tiers").update({
        quantity_sold: (tier.quantity_sold || 0) + attendeeList.length,
      }).eq("id", tier.id);

      // Legacy RSVP for backward compat
      if (userId) {
        await supabase.from("event_rsvps").upsert({
          event_id: eventId,
          user_id: userId,
          status: "going",
          ticket_purchased: false,
        }, { onConflict: "event_id,user_id" });
      }

      const origin = req.headers.get("origin") || "";
      return new Response(JSON.stringify({
        free: true,
        orderId: order.id,
        attendees: insertedAttendees,
        url: origin ? `${origin}/event/${eventId}/confirmation?order_id=${order.id}` : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- PAID PATH ----
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create pending order first
    const { data: order, error: orderErr } = await supabase
      .from("ticket_orders")
      .insert({
        event_id: eventId,
        purchaser_user_id: userId,
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
        purchaser_phone: purchaserPhone,
        purchaser_social: purchaserSocial,
        quantity: attendeeList.length,
        subtotal_cents: totalCents,
        total_cents: totalCents,
        currency: tier.currency,
        payment_method: "stripe",
        payment_status: "pending",
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // Create pending attendees so QR codes/numbers exist for confirmation
    const attendeeRows = attendeeList.map(a => ({
      event_id: eventId,
      order_id: order.id,
      tier_id: tier.id,
      attendee_user_id: userId,
      attendee_name: a.name,
      attendee_email: a.email || purchaserEmail,
      attendee_phone: a.phone,
      attendee_social: a.social,
      status: "registered",
    }));
    await supabase.from("event_attendees").insert(attendeeRows);

    // Creator connect info
    let creatorConnectId: string | null = null;
    let creatorPayoutEnabled = false;
    if (event.creator_id) {
      const { data: cp } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id, payout_enabled")
        .eq("user_id", event.creator_id)
        .single();
      if (cp) {
        creatorConnectId = cp.stripe_connect_account_id;
        creatorPayoutEnabled = cp.payout_enabled === true;
      }
    }

    // Existing customer?
    let customerId: string | undefined;
    if (purchaserEmail) {
      const customers = await stripe.customers.list({ email: purchaserEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : (purchaserEmail || undefined),
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: tier.currency,
          product_data: {
            name: `${event.title} — ${tier.name}`,
            description: tier.description || "Event ticket",
          },
          unit_amount: unitCents,
        },
        quantity: attendeeList.length,
      }],
      mode: "payment",
      success_url: `${origin}/event/${eventId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/event/${eventId}?ticket_cancelled=true`,
      metadata: {
        event_id: eventId,
        order_id: order.id,
        tier_id: tier.id,
        user_id: userId || "guest",
        type: "event_ticket",
      },
    };

    if (creatorConnectId && creatorPayoutEnabled) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: 0,
        transfer_data: { destination: creatorConnectId },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Save session id on the order
    await supabase
      .from("ticket_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    log("Session created", { sessionId: session.id, orderId: order.id });

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    const msg = error?.message || "Unknown error";
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
