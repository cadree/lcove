import {
  mapMembershipStatus,
  tierFromStripeSubscription,
} from "./membership-products.mjs";

function idOf(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function isoFromUnix(seconds) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function checkoutMeta(session) {
  const meta = session?.metadata || {};
  return {
    meta,
    type: meta.type || "",
    source: meta.source || "",
  };
}

export async function applyStripeEvent(event, db) {
  switch (event.type) {
    case "checkout.session.completed":
      await applyCheckoutCompleted(event.data.object, db);
      return;
    case "checkout.session.expired":
      await applyCheckoutExpired(event.data.object, db);
      return;
    case "invoice.payment_failed":
      await db.markInvoiceFailed(event.data.object);
      return;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await db.syncSubscription(event.data.object, event.type);
      return;
    case "charge.refunded":
      await db.markChargeRefunded(event.data.object);
      return;
    default:
      return;
  }
}

async function applyCheckoutCompleted(session, db) {
  const { meta, type, source } = checkoutMeta(session);

  if (type === "exclusive_track_purchase") {
    await db.recordExclusivePurchase(session);
  }
  if (type === "artist_subscription") {
    await db.recordArtistSubscription(session);
  }
  if (type === "fund_donation" || source === "fund_donation") {
    await db.insertDonation(session);
  } else if (type === "membership" || meta.tier === "community" || meta.tier === "elite") {
    await db.upsertMembershipFromCheckout(session);
  }
  if (meta.network_id) {
    await db.upsertNetworkSubscription(session);
  }
  if (type === "event_ticket") {
    await db.confirmEventTicket(session);
  }
  if (type === "store_order" || (meta.order_id && meta.item_id && type !== "event_ticket")) {
    await db.confirmStoreOrder(session);
  }
}

async function applyCheckoutExpired(session, db) {
  const { meta, type } = checkoutMeta(session);
  if (!meta.order_id) return;
  if (type === "event_ticket") {
    await db.cancelPendingTicketOrder(meta.order_id);
    return;
  }
  if (type === "store_order" || meta.item_id) {
    await db.cancelPendingStoreOrder(meta.order_id);
  }
}

export async function handleSignedStripeWebhook({
  rawBody,
  signature,
  webhookSecret,
  stripe,
  db,
}) {
  if (!webhookSecret) {
    return { status: 500, body: { error: "Webhook secret not configured" } };
  }
  if (!signature) {
    return { status: 400, body: { error: "Missing signature" } };
  }

  let event;
  try {
    // Deno's crypto provider only verifies asynchronously. Node accepts both.
    const verify = stripe.webhooks.constructEventAsync
      ? stripe.webhooks.constructEventAsync.bind(stripe.webhooks)
      : stripe.webhooks.constructEvent.bind(stripe.webhooks);
    event = await verify(rawBody, signature, webhookSecret);
  } catch {
    return { status: 400, body: { error: "Invalid signature" } };
  }

  let claimed = false;
  try {
    claimed = await db.claimEvent(event.id, event.type);
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : String(err) } };
  }
  if (!claimed) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    await applyStripeEvent(event, db);
    return { status: 200, body: { received: true } };
  } catch (err) {
    try {
      await db.releaseEvent(event.id);
    } catch {
      // The request still fails so Stripe retries the event.
    }
    return { status: 500, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

function throwIf(error) {
  if (error) throw new Error(error.message || "database write failed");
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

export function createSupabaseStripeDb(supabase, stripe) {
  return {
    async claimEvent(eventId, eventType) {
      const { error } = await supabase.from("processed_stripe_events").insert({
        event_id: eventId,
        event_type: eventType,
      });
      if (isUniqueViolation(error)) return false;
      throwIf(error);
      return true;
    },

    async releaseEvent(eventId) {
      const { error } = await supabase.from("processed_stripe_events").delete().eq("event_id", eventId);
      throwIf(error);
    },

    async recordExclusivePurchase(session) {
      const meta = session.metadata || {};
      const paymentIntentId = idOf(session.payment_intent);
      const amountCents = session.amount_total ?? 0;
      const { data: existing, error: readError } = await supabase
        .from("exclusive_track_purchases")
        .select("id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();
      throwIf(readError);
      if (existing) {
        const { error } = await supabase
          .from("exclusive_track_purchases")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            amount_cents: amountCents,
          })
          .eq("id", existing.id);
        throwIf(error);
        return;
      }
      const { error } = await supabase.from("exclusive_track_purchases").insert({
        track_id: meta.track_id,
        buyer_user_id: meta.buyer_user_id || session.client_reference_id,
        access_rule_id: meta.access_rule_id || null,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: amountCents,
        payment_status: "paid",
      });
      throwIf(error);
    },

    async recordArtistSubscription(session) {
      const meta = session.metadata || {};
      const subscriptionId = idOf(session.subscription);
      const customerId = idOf(session.customer);
      let currentPeriodEnd = null;
      let amountCents = 0;
      let interval = "monthly";
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = isoFromUnix(sub.current_period_end);
        amountCents = sub.items?.data?.[0]?.price?.unit_amount ?? 0;
        interval = sub.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
      }
      const { data: existing, error: readError } = await supabase
        .from("artist_subscriptions")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      throwIf(readError);
      if (existing) {
        const { error } = await supabase
          .from("artist_subscriptions")
          .update({
            status: "active",
            current_period_end: currentPeriodEnd,
            stripe_customer_id: customerId,
            amount_cents: amountCents,
            interval,
          })
          .eq("id", existing.id);
        throwIf(error);
        return;
      }
      const { error } = await supabase.from("artist_subscriptions").insert({
        artist_user_id: meta.artist_user_id,
        subscriber_user_id: meta.subscriber_user_id || session.client_reference_id,
        status: "active",
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        current_period_end: currentPeriodEnd,
        amount_cents: amountCents,
        interval,
      });
      throwIf(error);
    },

    async insertDonation(session) {
      const meta = session.metadata || {};
      const userId = meta.user_id && meta.user_id !== "guest" ? meta.user_id : null;
      const { error } = await supabase.from("donations").insert({
        user_id: userId,
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency || "usd",
        mode: session.mode === "subscription" ? "recurring" : "one_time",
        status: "paid",
        stripe_session_id: session.id,
        stripe_payment_intent_id: idOf(session.payment_intent),
        stripe_subscription_id: idOf(session.subscription),
        stripe_invoice_id: idOf(session.invoice),
      });
      if (isUniqueViolation(error)) return;
      throwIf(error);
    },

    async upsertMembershipFromCheckout(session) {
      const meta = session.metadata || {};
      const tier = meta.tier;
      const userId = meta.user_id;
      if (!userId || userId === "guest") throw new Error("membership checkout missing user");
      if (tier !== "community" && tier !== "elite") throw new Error("membership checkout missing tier");

      const subscriptionId = idOf(session.subscription);
      const customerId = idOf(session.customer);
      let periodStart = new Date().toISOString();
      let periodEnd = periodStart;
      let status = "active";
      let monthlyAmount = (session.amount_total ?? 0) / 100;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub.current_period_start) periodStart = isoFromUnix(sub.current_period_start);
        if (sub.current_period_end) periodEnd = isoFromUnix(sub.current_period_end);
        status = mapMembershipStatus(sub, "checkout.session.completed");
        const unit = sub.items?.data?.[0]?.price?.unit_amount;
        if (typeof unit === "number") monthlyAmount = unit / 100;
      }

      const { data: membership, error: upsertError } = await supabase
        .from("memberships")
        .upsert({
          user_id: userId,
          tier,
          status,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          monthly_amount: monthlyAmount,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select("id, lifetime_contribution")
        .maybeSingle();
      throwIf(upsertError);

      const amount = (session.amount_total ?? 0) / 100;
      const invoiceId = idOf(session.invoice) || session.id;
      const { error: contributionError } = await supabase.from("membership_contributions").insert({
        user_id: userId,
        membership_id: membership?.id ?? null,
        amount,
        period_start: periodStart,
        period_end: periodEnd,
        stripe_invoice_id: invoiceId,
      });
      if (!isUniqueViolation(contributionError)) throwIf(contributionError);

      const { data: contributions, error: sumError } = await supabase
        .from("membership_contributions")
        .select("amount")
        .eq("user_id", userId);
      throwIf(sumError);
      const lifetime = (contributions || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const { error: lifetimeError } = await supabase
        .from("memberships")
        .update({
          lifetime_contribution: lifetime,
          grant_eligible: lifetime >= 50 || tier === "elite",
        })
        .eq("user_id", userId);
      throwIf(lifetimeError);
    },

    async upsertNetworkSubscription(session) {
      const meta = session.metadata || {};
      if (!meta.network_id || !meta.user_id) throw new Error("network checkout missing ids");
      const subscriptionId = idOf(session.subscription);
      let periodStart = new Date().toISOString();
      let periodEnd = null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub.current_period_start) periodStart = isoFromUnix(sub.current_period_start);
        periodEnd = isoFromUnix(sub.current_period_end);
      }
      const { error } = await supabase.from("network_subscriptions").upsert({
        network_id: meta.network_id,
        user_id: meta.user_id,
        stripe_subscription_id: subscriptionId,
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
      }, { onConflict: "network_id,user_id" });
      throwIf(error);
    },

    async confirmStoreOrder(session) {
      const orderId = session.metadata?.order_id;
      if (!orderId) throw new Error("store checkout missing order");
      const { error } = await supabase.rpc("confirm_store_card_order", {
        p_order_id: orderId,
        p_payment_intent: idOf(session.payment_intent),
      });
      throwIf(error);
    },

    async confirmEventTicket(session) {
      const orderId = session.metadata?.order_id;
      if (!orderId) throw new Error("ticket checkout missing order");
      const { error } = await supabase.rpc("confirm_event_ticket_order", {
        p_order_id: orderId,
        p_payment_intent: idOf(session.payment_intent),
      });
      throwIf(error);
    },

    async cancelPendingStoreOrder(orderId) {
      const { error } = await supabase.rpc("cancel_pending_store_order", { p_order_id: orderId });
      throwIf(error);
    },

    async cancelPendingTicketOrder(orderId) {
      const { error } = await supabase.rpc("cancel_pending_ticket_order", { p_order_id: orderId });
      throwIf(error);
    },

    async markInvoiceFailed(invoice) {
      const subId = idOf(invoice.subscription);
      if (!subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      await this.syncSubscription(sub, "invoice.payment_failed");
    },

    async syncSubscription(sub, eventType) {
      const periodEnd = isoFromUnix(sub.current_period_end);
      const failed = eventType === "invoice.payment_failed";
      const deleted = eventType === "customer.subscription.deleted";
      const artistStatus = failed
        ? "past_due"
        : (!deleted && (sub.status === "active" || sub.status === "trialing") ? "active" : "canceled");

      const { error: artistError } = await supabase
        .from("artist_subscriptions")
        .update({
          status: artistStatus,
          current_period_end: periodEnd,
          cancel_at_period_end: !!sub.cancel_at_period_end,
        })
        .eq("stripe_subscription_id", sub.id);
      throwIf(artistError);

      const meta = sub.metadata || {};
      const tier = tierFromStripeSubscription(sub);
      if (tier && meta.type !== "network_subscription") {
        const { error } = await supabase
          .from("memberships")
          .update({
            status: mapMembershipStatus(sub, eventType),
            current_period_end: periodEnd,
            tier,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);
        throwIf(error);
      }

      if (meta.network_id || meta.type === "network_subscription") {
        const networkStatus = failed
          ? "past_due"
          : (deleted ? "canceled" : (sub.status === "active" || sub.status === "trialing" ? "active" : sub.status || "canceled"));
        const { error } = await supabase
          .from("network_subscriptions")
          .update({
            status: networkStatus,
            current_period_end: periodEnd,
          })
          .eq("stripe_subscription_id", sub.id);
        throwIf(error);
      }
    },

    async markChargeRefunded(charge) {
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return;
      const { error: storeError } = await supabase.rpc("mark_store_order_refunded", {
        p_payment_intent: paymentIntentId,
      });
      throwIf(storeError);
      const { error: donationError } = await supabase
        .from("donations")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", paymentIntentId);
      throwIf(donationError);
      const { error: ticketError } = await supabase
        .from("ticket_orders")
        .update({
          payment_status: "refunded",
          refunded_at: new Date().toISOString(),
          refund_amount_cents: charge.amount_refunded ?? charge.amount ?? 0,
        })
        .eq("stripe_payment_intent_id", paymentIntentId);
      throwIf(ticketError);
    },
  };
}
