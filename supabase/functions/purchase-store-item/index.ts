import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { STORE_PLATFORM_FEE_PERCENT } from "../_shared/fees.mjs";
import { assertStripeTestKey } from "../_shared/stripe-mode.mjs";
import { verifiedDestination } from "../_shared/creator-connect.mjs";
import { ledgerBalances } from "../_shared/credit-balances.ts";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = STORE_PLATFORM_FEE_PERCENT;

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

    const { itemId, paymentType, quantity = 1, action, orderId } = await req.json();

    if (action === "cancel") {
      if (!orderId) throw new Error("Missing orderId");
      const { data: pendingOrder, error: pendingError } = await supabaseAdmin
        .from("store_orders")
        .select("id, buyer_id, status")
        .eq("id", orderId)
        .maybeSingle();
      if (pendingError || !pendingOrder || pendingOrder.buyer_id !== user.id) {
        throw new Error("Order not found");
      }
      const { error: cancelError } = await supabaseAdmin.rpc("cancel_pending_store_order", {
        p_order_id: orderId,
      });
      if (cancelError) throw new Error(cancelError.message);
      return new Response(
        JSON.stringify({ cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (!itemId || !paymentType) {
      throw new Error("Missing required fields: itemId, paymentType");
    }

    // Get the store item with store details including Connect info
    const { data: item, error: itemError } = await supabaseClient
      .from("store_items")
      .select("*, store:stores(id, user_id, name, payout_enabled, accepts_cash, accepts_credits, flat_shipping_cents, tax_line_label, tax_line_cents)")
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

    const { data: storeSecrets } = await supabaseAdmin
      .from("store_secrets")
      .select("stripe_connect_account_id")
      .eq("store_id", store.id)
      .maybeSingle();
    const profileDestination = await verifiedDestination(supabaseAdmin, store.user_id);
    const connectAccountId = profileDestination
      || (store.payout_enabled ? storeSecrets?.stripe_connect_account_id ?? null : null);

    logStep(`Processing ${paymentType} purchase for item ${itemId}`, { 
      itemTitle: item.title,
      storeId: store.id,
      hasConnect: !!connectAccountId,
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

      if (item.external_url) {
        throw new Error("This item is sold outside Ether");
      }

      const totalCredits = item.credits_price * quantity;
      const userCredits = await ledgerBalances(supabaseAdmin, user.id);
      const balance = userCredits.balance;
      if (balance < totalCredits) {
        throw new Error(`Insufficient credits. You have ${balance} LC, but need ${totalCredits} LC`);
      }

      const { data: creditResult, error: creditError } = await supabaseAdmin.rpc(
        "complete_store_credit_purchase",
        {
          p_buyer_id: user.id,
          p_item_id: itemId,
          p_quantity: quantity,
        },
      );
      if (creditError) {
        throw new Error(creditError.message);
      }

      logStep("Credit payment completed", { orderId: creditResult?.order_id });

      return new Response(
        JSON.stringify({ success: true, orderId: creditResult?.order_id }),
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

      if (item.external_url) {
        throw new Error("This item is sold outside Ether");
      }

      const merchandiseCents = Math.round(item.price * 100) * quantity;
      const shippingCents = item.type === "product" ? Number(store.flat_shipping_cents || 0) : 0;
      const taxCents = Number(store.tax_line_cents || 0);
      const platformFeeAmount = Math.round(merchandiseCents * (PLATFORM_FEE_PERCENT / 100));
      const sellerAmount = merchandiseCents - platformFeeAmount + shippingCents + taxCents;
      const totalPrice = (merchandiseCents + shippingCents + taxCents) / 100;

      logStep("Cash split calculated", { 
        totalPrice, 
        platformFeeAmount: platformFeeAmount / 100, 
        sellerAmount: sellerAmount / 100 
      });

      // Initialize Stripe
      const stripe = new Stripe(assertStripeTestKey(Deno.env.get("STRIPE_SECRET_KEY")), {
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
          seller_payout_status: connectAccountId ? "processing" : "pending_setup",
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order creation error:", orderError);
        throw new Error("Failed to create order");
      }

      // Build checkout session config
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
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
      ];
      if (shippingCents > 0) {
        lineItems.push({
          price_data: {
            currency: item.currency.toLowerCase(),
            product_data: { name: "Shipping (seller arranges)" },
            unit_amount: shippingCents,
          },
          quantity: 1,
        });
      }
      if (taxCents > 0) {
        lineItems.push({
          price_data: {
            currency: item.currency.toLowerCase(),
            product_data: { name: store.tax_line_label || "Tax" },
            unit_amount: taxCents,
          },
          quantity: 1,
        });
      }

      const origin = req.headers.get("origin") || "http://localhost:3000";
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email!,
        line_items: lineItems,
        mode: "payment",
        success_url: `${origin}/store?purchase=success&order=${order.id}`,
        cancel_url: `${origin}/store?purchase=cancel&order=${order.id}`,
        metadata: {
          type: "store_order",
          order_id: order.id,
          item_id: itemId,
          buyer_id: user.id,
        },
        payment_intent_data: {
          receipt_email: user.email || undefined,
        },
      };

      // Sellers arrange shipping themselves. The seller-entered amount is a line item above.
      // Ether does not collect a shipping address or limit countries.
      // Connect fee is STORE_PLATFORM_FEE_PERCENT of the item price. Shipping and tax are not in the fee.
      // Linked Shopify items are rejected above and never reach this split.
      if (connectAccountId) {
        sessionConfig.payment_intent_data = {
          ...sessionConfig.payment_intent_data,
          ...(platformFeeAmount > 0 ? { application_fee_amount: platformFeeAmount } : {}),
          transfer_data: {
            destination: connectAccountId,
          },
        };
        logStep("Using Stripe Connect with application fee", { 
          platformFeeAmount, 
          connectAccountId
        });
      }

      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create(sessionConfig);
      } catch (sessionError) {
        await supabaseAdmin.rpc("cancel_pending_store_order", { p_order_id: order.id });
        throw sessionError;
      }

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
        description: `Platform fee (${PLATFORM_FEE_PERCENT}%): ${item.title}`,
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: httpStatusForError(error) }
    );
  }
});
