import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-TICKET-PAYMENT] ${step}${detailsStr}`);
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

    logStep("Verifying payment", { sessionId });

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
    const creatorId = session.metadata?.creator_id;
    const eventIdFromSession = session.metadata?.event_id || eventId;
    const ticketAmount = session.amount_total ? session.amount_total / 100 : 0;

    logStep("Payment verified", { userId, creatorId, eventId: eventIdFromSession, amount: ticketAmount });

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
      logStep("Error updating RSVP", { error: rsvpError.message });
      throw rsvpError;
    }

    // Create transaction record for buyer
    const { error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        amount: ticketAmount,
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
      logStep("Error creating buyer transaction", { error: txError.message });
    }

    // Check if creator has Connect enabled and credit them
    if (creatorId) {
      const { data: creatorProfile } = await supabaseClient
        .from("profiles")
        .select("stripe_connect_account_id, payout_enabled")
        .eq("user_id", creatorId)
        .single();

      // If creator has Connect enabled, payment already went to them via Stripe
      // If not, we credit their earned_balance (95% of ticket price)
      if (!creatorProfile?.stripe_connect_account_id || !creatorProfile?.payout_enabled) {
        const creatorEarnings = Math.floor(ticketAmount * 0.95 * 100); // 95% in credits (1 credit = $0.01)
        
        logStep("Crediting creator earned_balance", { 
          creatorId, 
          credits: creatorEarnings,
          ticketAmount 
        });

        // Award credits to creator
        const { error: creditError } = await supabaseClient
          .from('credit_ledger')
          .insert({
            user_id: creatorId,
            amount: creatorEarnings,
            balance_after: 0, // Will be updated by trigger
            type: 'earn',
            credit_type: 'earned',
            earned_amount: creatorEarnings,
            genesis_amount: 0,
            description: `Event ticket sale (95% of $${ticketAmount.toFixed(2)})`,
            reference_type: 'event_ticket_sale',
            reference_id: eventIdFromSession,
          });

        if (creditError) {
          logStep("Error crediting creator", { error: creditError.message });
        } else {
          logStep("Creator credited successfully", { credits: creatorEarnings });
        }
      } else {
        logStep("Creator has Connect enabled, payment handled via Stripe split");
      }
    }

    logStep("Payment verified and RSVP updated", { userId });

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
