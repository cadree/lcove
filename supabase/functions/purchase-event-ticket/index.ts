import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { assertEventStripeTestKey } from "../_shared/stripe-mode.mjs";
import { priceCheckout } from "../_shared/ticket-fees.mjs";
import { sendOrderConfirmation } from "../_shared/order-confirmation-email.ts";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[purchase-event-ticket] ${step}${d}`);
};

function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function attendeeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function missingColumn(error: { message?: string } | null): boolean {
  const message = error?.message || "";
  return /does not exist|schema cache|could not find/i.test(message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

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
      tierId,
      attendees,
      lines,
      buyer,
      marketingConsent,
      password,
      quantity: legacyQty,
      guestName,
      guestEmail,
      guestPhone,
    } = body;

    if (!eventId) throw new Error("eventId is required");

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, title, creator_id, ticket_price, capacity")
      .eq("id", eventId)
      .single();
    if (eventErr || !event) throw new Error("Event not found");

    let absorbFees = false;
    let passwordProtected = false;
    const extra = await supabase
      .from("events")
      .select("absorb_fees, password_protected")
      .eq("id", eventId)
      .maybeSingle();
    if (!extra.error && extra.data) {
      absorbFees = extra.data.absorb_fees === true;
      passwordProtected = extra.data.password_protected === true;
    } else if (extra.error && !missingColumn(extra.error)) {
      throw extra.error;
    }

    if (passwordProtected) {
      const gate = await supabase.rpc("event_password_ok", {
        p_event_id: eventId,
        p_password: typeof password === "string" ? password : "",
      });
      if (gate.error && !missingColumn(gate.error)) throw gate.error;
      if (!gate.error && gate.data !== true) throw new Error("This event needs the password.");
    }

    const buyerName = attendeeText(buyer?.name || guestName || userEmail || "Guest").trim() || "Guest";
    const buyerEmail = attendeeText(buyer?.email || guestEmail || userEmail || "").trim().toLowerCase();
    const buyerPhone = attendeeText(buyer?.phone || guestPhone || "").trim();

    let requested: { tierId: string; quantity: number }[] = [];
    if (Array.isArray(lines) && lines.length > 0) {
      requested = lines
        .filter((line) => line && typeof line.tierId === "string")
        .map((line) => ({ tierId: line.tierId, quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)) }));
    }

    let namedAttendees: { name: string; email?: string; phone?: string; social?: string }[] = [];
    if (Array.isArray(attendees) && attendees.length > 0) {
      namedAttendees = attendees
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          name: attendeeText(item.name).trim(),
          email: item.email ? attendeeText(item.email).trim().toLowerCase() : undefined,
          phone: item.phone ? attendeeText(item.phone).trim() : undefined,
          social: item.social ? attendeeText(item.social).trim().replace(/^@/, "") : undefined,
        }))
        .filter((item) => item.name);
    }

    if (requested.length === 0) {
      const qty = namedAttendees.length || Math.max(1, Number(legacyQty || 1));
      requested = [{ tierId: typeof tierId === "string" ? tierId : "", quantity: qty }];
    }

    const totalQty = requested.reduce((sum, line) => sum + line.quantity, 0);
    if (totalQty < 1) throw new Error("At least one attendee required");
    if (totalQty > 20) throw new Error("Maximum 20 tickets per order");

    const { error: releaseError } = await supabase.rpc("release_abandoned_ticket_orders", {
      p_older_than: "24 hours",
    });
    if (releaseError) log("Abandoned release skipped", { message: releaseError.message });

    const resolved = [];
    for (const request of requested) {
      let tier = null;
      if (request.tierId) {
        const { data } = await supabase
          .from("ticket_tiers")
          .select("*")
          .eq("id", request.tierId)
          .eq("event_id", eventId)
          .eq("is_active", true)
          .maybeSingle();
        tier = data;
      }
      if (!tier) {
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
      if (tier.capacity != null) {
        const remaining = tier.capacity - (tier.quantity_sold || 0);
        if (remaining < request.quantity) {
          throw new Error(`Only ${Math.max(0, remaining)} ticket(s) remaining for ${tier.name}`);
        }
      }
      resolved.push({ tier, quantity: request.quantity });
    }

    if (event.capacity != null) {
      const { count, error: seatError } = await supabase
        .from("event_attendees")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ["registered", "approved"]);
      if (seatError) throw seatError;
      if ((count || 0) + totalQty > event.capacity) throw new Error("This event is sold out");
    }

    const priced = priceCheckout(resolved.map((line) => ({
      tierId: line.tier.id,
      name: line.tier.name,
      description: line.tier.description,
      priceCents: line.tier.price_cents || 0,
      quantity: line.quantity,
    })), absorbFees);

    const people = namedAttendees.length === totalQty
      ? namedAttendees
      : Array.from({ length: totalQty }, (_, index) => ({
        name: index === 0 ? buyerName : `${buyerName} (${index + 1})`,
        email: buyerEmail || undefined,
        phone: index === 0 ? buyerPhone || undefined : undefined,
      }));

    let cursor = 0;
    const attendeeRows = resolved.flatMap((line) => {
      const rows = [];
      for (let i = 0; i < line.quantity; i += 1) {
        const person = people[cursor] || { name: buyerName, email: buyerEmail };
        cursor += 1;
        rows.push({
          event_id: eventId,
          tier_id: line.tier.id,
          attendee_user_id: userId,
          attendee_name: person.name,
          attendee_email: person.email || buyerEmail || null,
          attendee_phone: person.phone || null,
          attendee_social: "social" in person ? person.social || null : null,
          status: "registered",
        });
      }
      return rows;
    });

    const isFree = priced.total === 0;
    const notes = marketingConsent === true ? "marketing_opt_in" : null;
    const currency = resolved[0].tier.currency || "usd";

    const { data: order, error: orderErr } = await supabase
      .from("ticket_orders")
      .insert({
        event_id: eventId,
        purchaser_user_id: userId,
        purchaser_name: buyerName,
        purchaser_email: buyerEmail || null,
        purchaser_phone: buyerPhone || null,
        purchaser_social: namedAttendees[0]?.social || null,
        quantity: totalQty,
        subtotal_cents: priced.subtotal,
        total_cents: priced.total,
        currency,
        payment_method: isFree ? "free" : "stripe",
        payment_status: isFree ? "paid" : "pending",
        notes,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    const { data: insertedAttendees, error: attErr } = await supabase
      .from("event_attendees")
      .insert(attendeeRows.map((row) => ({ ...row, order_id: order.id })))
      .select("id, qr_code, ticket_number, attendee_name");
    if (attErr) {
      await supabase.from("ticket_orders").delete().eq("id", order.id);
      if (attErr.message.toLowerCase().includes("sold out")) throw new Error("This event is sold out");
      throw attErr;
    }

    for (const line of resolved) {
      await supabase.from("ticket_tiers").update({
        quantity_sold: (line.tier.quantity_sold || 0) + line.quantity,
      }).eq("id", line.tier.id);
    }

    if (userId) {
      await supabase.from("event_rsvps").upsert({
        event_id: eventId,
        user_id: userId,
        status: "going",
        ticket_purchased: !isFree,
      }, { onConflict: "event_id,user_id" });
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";

    if (isFree) {
      sendOrderConfirmation(supabase, order.id).catch((error) => log("email", { message: errorMessage(error) }));
      return new Response(JSON.stringify({
        free: true,
        orderId: order.id,
        attendees: insertedAttendees,
        url: `${origin}/event/${eventId}/confirmation?order_id=${order.id}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");
    const stripe = new Stripe(assertEventStripeTestKey(stripeKey), { apiVersion: "2025-08-27.basil" });

    let creatorConnectId: string | null = null;
    let creatorPayoutEnabled = false;
    if (event.creator_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id, payout_enabled")
        .eq("user_id", event.creator_id)
        .maybeSingle();
      if (profile) {
        creatorConnectId = profile.stripe_connect_account_id;
        creatorPayoutEnabled = profile.payout_enabled === true;
      }
    }

    let customerId: string | undefined;
    if (buyerEmail) {
      const customers = await stripe.customers.list({ email: buyerEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : (buyerEmail || undefined),
      payment_method_types: ["card"],
      line_items: priced.lines.map((line) => ({
        price_data: {
          currency,
          product_data: {
            name: `${event.title} — ${line.name}`,
            description: line.description || "Event ticket",
          },
          unit_amount: line.unitAmount,
        },
        quantity: line.quantity,
      })),
      mode: "payment",
      success_url: `${origin}/event/${eventId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/event/${eventId}?ticket_cancelled=true`,
      metadata: {
        event_id: eventId,
        order_id: order.id,
        tier_id: resolved[0].tier.id,
        user_id: userId || "guest",
        type: "event_ticket",
      },
    };

    if (creatorConnectId && creatorPayoutEnabled) {
      sessionConfig.payment_intent_data = {
        transfer_data: { destination: creatorConnectId },
        ...(priced.fee > 0 ? { application_fee_amount: priced.fee } : {}),
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    await supabase.from("ticket_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    log("Session created", { sessionId: session.id, orderId: order.id, fee: priced.fee });

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const msg = errorMessage(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(error),
    });
  }
});
