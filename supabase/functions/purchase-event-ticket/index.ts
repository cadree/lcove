import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-EVENT-TICKET] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Create Supabase client with service role for reading creator info
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    let userEmail = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    }

    const { eventId, eventTitle, ticketPrice, quantity = 1 } = await req.json();

    if (!eventId) {
      throw new Error("Missing required field: eventId");
    }

    if (!ticketPrice || ticketPrice <= 0) {
      throw new Error("Invalid ticket price: A valid ticket price is required for paid events");
    }

    logStep("Creating checkout session", { eventId, price: ticketPrice, userId });

    // Fetch event with creator's connect account info
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select(`
        id,
        title,
        creator_id,
        ticket_price
      `)
      .eq("id", eventId)
      .single();

    if (eventError) {
      logStep("Error fetching event", { error: eventError.message });
    }

    // Fetch creator's profile for connect info
    let creatorConnectId: string | null = null;
    let creatorPayoutEnabled = false;

    if (event?.creator_id) {
      const { data: creatorProfile } = await supabaseClient
        .from("profiles")
        .select("stripe_connect_account_id, payout_enabled")
        .eq("user_id", event.creator_id)
        .single();

      if (creatorProfile) {
        creatorConnectId = creatorProfile.stripe_connect_account_id;
        creatorPayoutEnabled = creatorProfile.payout_enabled === true;
        logStep("Creator profile found", { 
          hasConnect: !!creatorConnectId, 
          payoutEnabled: creatorPayoutEnabled 
        });
      }
    }

    // Check if customer exists
    let customerId = undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    // Get the origin for redirect URLs
    const origin = req.headers.get("origin") || "http://localhost:5173";

    // Build the checkout session config
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Ticket: ${eventTitle || 'Event'}`,
              description: `Event ticket purchase`,
            },
            unit_amount: Math.round(ticketPrice * 100), // Convert to cents
          },
          quantity: quantity,
        },
      ],
      mode: "payment",
      success_url: `${origin}/calendar?ticket_success=true&event=${eventId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/calendar?ticket_cancelled=true&event=${eventId}`,
      metadata: {
        event_id: eventId,
        user_id: userId || 'guest',
        creator_id: event?.creator_id || '',
        type: "event_ticket",
      },
    };

    // If creator has Stripe Connect enabled, split the payment 95/5
    if (creatorConnectId && creatorPayoutEnabled) {
      const platformFeeAmount = Math.round(ticketPrice * 100 * 0.05); // 5% platform fee
      logStep("Using Stripe Connect split", { 
        creatorConnectId, 
        platformFee: platformFeeAmount / 100,
        creatorPayout: (ticketPrice * 100 - platformFeeAmount) / 100
      });

      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: creatorConnectId,
        },
      };
    } else {
      logStep("No Connect account, payment goes to platform");
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    logStep("Checkout session created", { sessionId: session.id, hasConnect: !!creatorConnectId });

    // If user is logged in, create or update their RSVP to pending payment
    if (userId) {
      const { error: rsvpError } = await supabaseClient
        .from('event_rsvps')
        .upsert({
          event_id: eventId,
          user_id: userId,
          status: 'going',
          stripe_payment_id: session.id,
        }, {
          onConflict: 'event_id,user_id'
        });

      if (rsvpError) {
        console.error('Error updating RSVP:', rsvpError);
      }
    }

    return new Response(
      JSON.stringify({ 
        sessionId: session.id, 
        url: session.url 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
