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
  console.log(`[PURCHASE-STORE-ITEM] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
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
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    logStep("User authenticated", { userId: user.id });

    const { itemId, paymentType, quantity = 1 } = await req.json();

    if (!itemId || !paymentType) {
      throw new Error("Missing required fields: itemId, paymentType");
    }

    // Get the store item with store details including Connect info
    const { data: item, error: itemError } = await supabaseClient
      .from("store_items")
      .select("*, store:stores(*, stripe_connect_account_id, payout_enabled)")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      throw new Error("Item not found");
    }

    // Check inventory for products
    if (item.type === "product" && item.inventory_count !== null) {
      if (item.inventory_count < quantity) {
        throw new Error("Insufficient inventory");
      }
    }

    // Get the store to check payment options
    const store = item.store;
    if (!store) {
      throw new Error("Store not found");
    }

    logStep(`Processing ${paymentType} purchase for item ${itemId}`, { 
      itemTitle: item.title,
      storeId: store.id,
      hasConnect: !!store.stripe_connect_account_id,
      payoutEnabled: store.payout_enabled
    });

    if (paymentType === "credits") {
      // Check if store accepts credits
      if (!store.accepts_credits) {
        throw new Error("This store does not accept credits");
      }

      if (!item.credits_price || item.credits_price <= 0) {
        throw new Error("This item cannot be purchased with credits");
      }

      const totalCredits = item.credits_price * quantity;
      
      // Calculate 80/20 split for credits
      const sellerCredits = Math.floor(totalCredits * 0.80);
      const platformCredits = totalCredits - sellerCredits;

      logStep("Credit split calculated", { totalCredits, sellerCredits, platformCredits });

      // Check user's credit balance
      const { data: userCredits, error: creditsError } = await supabaseClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      const balance = userCredits?.balance || 0;
      if (balance < totalCredits) {
        throw new Error(`Insufficient credits. You have ${balance} LC, but need ${totalCredits} LC`);
      }

      // Create the order with fee breakdown
      const { data: order, error: orderError } = await supabaseAdmin
        .from("store_orders")
        .insert({
          store_id: store.id,
          buyer_id: user.id,
          item_id: itemId,
          quantity,
          total_price: 0,
          credits_spent: totalCredits,
          payment_type: "credits",
          status: "confirmed",
          seller_amount: sellerCredits,
          platform_fee: platformCredits,
          seller_payout_status: "completed",
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order creation error:", orderError);
        throw new Error("Failed to create order");
      }

      // Deduct credits from buyer
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: user.id,
        amount: -totalCredits,
        balance_after: balance - totalCredits,
        type: "purchase",
        description: `Purchased: ${item.title}`,
        reference_type: "store_order",
        reference_id: order.id,
      });

      // Add 80% credits to seller
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
        description: `Sale (80%): ${item.title}`,
        reference_type: "store_order",
        reference_id: order.id,
      });

      // Record platform fee in treasury
      await supabaseAdmin.from("platform_treasury").insert({
        source_type: "store_order",
        source_id: order.id,
        amount: 0,
        credits_amount: platformCredits,
        description: `Platform fee (20%): ${item.title}`,
      });

      logStep("Credit payment completed", { orderId: order.id, sellerCredits, platformCredits });

      // Update inventory if applicable
      if (item.type === "product" && item.inventory_count !== null) {
        await supabaseAdmin
          .from("store_items")
          .update({ inventory_count: item.inventory_count - quantity })
          .eq("id", itemId);
      }

      return new Response(
        JSON.stringify({ success: true, orderId: order.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else if (paymentType === "cash") {
      // Check if store accepts cash
      if (!store.accepts_cash) {
        throw new Error("This store does not accept cash payments");
      }

      if (!item.price || item.price <= 0) {
        throw new Error("This item does not have a cash price");
      }

      const totalPrice = item.price * quantity;
      
      // Calculate fee amounts in cents
      const platformFeeAmount = Math.round(totalPrice * 100 * (PLATFORM_FEE_PERCENT / 100));
      const sellerAmount = (totalPrice * 100) - platformFeeAmount;

      logStep("Cash split calculated", { 
        totalPrice, 
        platformFeeAmount: platformFeeAmount / 100, 
        sellerAmount: sellerAmount / 100 
      });

      // Initialize Stripe
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Check for existing Stripe customer
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      // Create the order first (pending status)
      const { data: order, error: orderError } = await supabaseAdmin
        .from("store_orders")
        .insert({
          store_id: store.id,
          buyer_id: user.id,
          item_id: itemId,
          quantity,
          total_price: totalPrice,
          credits_spent: 0,
          payment_type: "cash",
          status: "pending",
          seller_amount: sellerAmount / 100,
          platform_fee: platformFeeAmount / 100,
          seller_payout_status: store.payout_enabled ? "processing" : "pending_setup",
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order creation error:", orderError);
        throw new Error("Failed to create order");
      }

      // Build checkout session config
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email!,
        line_items: [
          {
            price_data: {
              currency: item.currency.toLowerCase(),
              product_data: {
                name: item.title,
                description: item.description || undefined,
                images: item.images?.length > 0 ? [item.images[0]] : undefined,
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/store?purchase=success&order=${order.id}`,
        cancel_url: `${req.headers.get("origin")}/store?purchase=cancelled`,
        metadata: {
          order_id: order.id,
          item_id: itemId,
          buyer_id: user.id,
        },
      };

      // If seller has Stripe Connect enabled, use application fee for automatic 80/20 split
      if (store.stripe_connect_account_id && store.payout_enabled) {
        sessionConfig.payment_intent_data = {
          application_fee_amount: platformFeeAmount,
          transfer_data: {
            destination: store.stripe_connect_account_id,
          },
        };
        logStep("Using Stripe Connect with application fee", { 
          platformFeeAmount, 
          connectAccountId: store.stripe_connect_account_id 
        });
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create(sessionConfig);

      // Update order with stripe payment intent
      await supabaseAdmin
        .from("store_orders")
        .update({ stripe_payment_intent_id: session.payment_intent as string })
        .eq("id", order.id);

      // Record platform fee in treasury
      await supabaseAdmin.from("platform_treasury").insert({
        source_type: "store_order",
        source_id: order.id,
        amount: platformFeeAmount / 100,
        credits_amount: 0,
        description: `Platform fee (20%): ${item.title}`,
      });

      logStep("Checkout session created", { sessionUrl: session.url, orderId: order.id });

      return new Response(
        JSON.stringify({ url: session.url, orderId: order.id }),
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
