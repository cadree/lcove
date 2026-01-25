import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 20;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-STUDIO-BOOKING] ${step}${detailsStr}`);
};

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
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) throw new Error("Authentication failed");
    logStep("User authenticated", { userId: user.id });

    const { bookingId, paymentType } = await req.json();

    if (!bookingId || !paymentType) {
      throw new Error("Missing required fields: bookingId, paymentType");
    }

    // Get the booking with item and store details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("studio_bookings")
      .select(`
        *,
        item:store_items(
          id, title, description, price, credits_price, currency, images,
          store:stores(id, user_id, name, stripe_connect_account_id, payout_enabled, accepts_cash, accepts_credits)
        )
      `)
      .eq("id", bookingId)
      .eq("requester_id", user.id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found or you don't have access");
    }

    if (booking.status !== 'approved') {
      throw new Error("Booking must be approved before payment");
    }

    const item = booking.item;
    const store = item?.store;

    if (!item || !store) {
      throw new Error("Item or store not found");
    }

    const totalPrice = booking.total_price || (item.price * (booking.duration_hours || 1));
    const totalCredits = booking.credits_spent || (item.credits_price ? item.credits_price * (booking.duration_hours || 1) : 0);

    logStep(`Processing ${paymentType} payment for booking`, { bookingId, totalPrice, totalCredits });

    if (paymentType === "credits") {
      if (!store.accepts_credits) {
        throw new Error("This store does not accept credits");
      }

      if (!totalCredits || totalCredits <= 0) {
        throw new Error("This item cannot be purchased with credits");
      }

      // Calculate 80/20 split
      const sellerCredits = Math.floor(totalCredits * 0.80);
      const platformCredits = totalCredits - sellerCredits;

      // Check user's credit balance
      const { data: userCredits } = await supabaseClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      const balance = userCredits?.balance || 0;
      if (balance < totalCredits) {
        throw new Error(`Insufficient credits. You have ${balance} LC, but need ${totalCredits} LC`);
      }

      // Deduct credits from buyer
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: user.id,
        amount: -totalCredits,
        balance_after: balance - totalCredits,
        type: "purchase",
        description: `Studio booking: ${item.title}`,
        reference_type: "studio_booking",
        reference_id: bookingId,
      });

      // Add 80% to seller
      const { data: sellerCreditsData } = await supabaseAdmin
        .from("user_credits")
        .select("balance")
        .eq("user_id", store.user_id)
        .single();

      const sellerBalance = sellerCreditsData?.balance || 0;
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: store.user_id,
        amount: sellerCredits,
        balance_after: sellerBalance + sellerCredits,
        type: "sale",
        description: `Studio booking sale (80%): ${item.title}`,
        reference_type: "studio_booking",
        reference_id: bookingId,
      });

      // Record platform fee in treasury
      await supabaseAdmin.from("platform_treasury").insert({
        source_type: "studio_booking",
        source_id: bookingId,
        amount: 0,
        credits_amount: platformCredits,
        description: `Platform fee (20%): ${item.title}`,
      });

      // Update booking status and fee breakdown
      await supabaseAdmin
        .from("studio_bookings")
        .update({ 
          status: "completed",
          credits_spent: totalCredits,
          payment_type: "credits",
          seller_amount: sellerCredits,
          platform_fee: platformCredits,
          seller_payout_status: "completed",
        })
        .eq("id", bookingId);

      logStep("Credit payment completed", { sellerCredits, platformCredits });

      return new Response(
        JSON.stringify({ success: true, bookingId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else if (paymentType === "cash") {
      if (!store.accepts_cash) {
        throw new Error("This store does not accept cash payments");
      }

      if (!totalPrice || totalPrice <= 0) {
        throw new Error("This item does not have a cash price");
      }

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Check for existing Stripe customer
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      // Calculate fee amounts
      const platformFeeAmount = Math.round(totalPrice * 100 * (PLATFORM_FEE_PERCENT / 100));
      const sellerAmount = (totalPrice * 100) - platformFeeAmount;

      // Create checkout session with or without Connect
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email!,
        line_items: [
          {
            price_data: {
              currency: item.currency?.toLowerCase() || 'usd',
              product_data: {
                name: `Studio Booking: ${item.title}`,
                description: `${booking.duration_hours || 1} hour(s) on ${booking.requested_date}`,
                images: item.images?.length > 0 ? [item.images[0]] : undefined,
              },
              unit_amount: Math.round(totalPrice * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/store?booking_success=true&booking=${bookingId}`,
        cancel_url: `${req.headers.get("origin")}/store?booking_cancelled=true`,
        metadata: {
          booking_id: bookingId,
          item_id: item.id,
          buyer_id: user.id,
          type: "studio_booking",
        },
      };

      // If seller has Stripe Connect enabled, use application fee
      if (store.stripe_connect_account_id && store.payout_enabled) {
        sessionConfig.payment_intent_data = {
          application_fee_amount: platformFeeAmount,
          transfer_data: {
            destination: store.stripe_connect_account_id,
          },
        };
        logStep("Using Stripe Connect with application fee", { 
          platformFeeAmount, 
          sellerAmount,
          connectAccountId: store.stripe_connect_account_id 
        });
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      // Update booking with payment info
      await supabaseAdmin
        .from("studio_bookings")
        .update({ 
          stripe_payment_intent_id: session.payment_intent as string,
          total_price: totalPrice,
          payment_type: "cash",
          seller_amount: sellerAmount / 100,
          platform_fee: platformFeeAmount / 100,
          seller_payout_status: store.payout_enabled ? "processing" : "pending_setup",
        })
        .eq("id", bookingId);

      // Record platform fee in treasury
      await supabaseAdmin.from("platform_treasury").insert({
        source_type: "studio_booking",
        source_id: bookingId,
        amount: platformFeeAmount / 100,
        credits_amount: 0,
        description: `Platform fee (20%): ${item.title}`,
      });

      logStep("Checkout session created", { sessionUrl: session.url });

      return new Response(
        JSON.stringify({ url: session.url, bookingId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else {
      throw new Error("Invalid payment type");
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message });
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
