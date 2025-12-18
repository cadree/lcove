import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId, eventId } = await req.json();

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    console.log(`Verifying payment for session: ${sessionId}`);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment not completed' 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const userId = session.metadata?.user_id;
    const eventIdFromSession = session.metadata?.event_id || eventId;

    if (!userId || userId === 'guest') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment verified (guest checkout)' 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Update the RSVP to mark ticket as purchased
    const { error: rsvpError } = await supabaseClient
      .from('event_rsvps')
      .update({ 
        ticket_purchased: true,
        stripe_payment_id: session.payment_intent as string,
      })
      .eq('event_id', eventIdFromSession)
      .eq('user_id', userId);

    if (rsvpError) {
      console.error('Error updating RSVP:', rsvpError);
      throw rsvpError;
    }

    // Create transaction record
    const { error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency?.toUpperCase() || 'USD',
        type: 'event_ticket',
        status: 'completed',
        stripe_payment_intent_id: session.payment_intent as string,
        description: `Ticket purchase for event`,
        metadata: {
          event_id: eventIdFromSession,
          session_id: sessionId,
        }
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
    }

    console.log(`Payment verified and RSVP updated for user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment verified and ticket confirmed' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error verifying payment:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
