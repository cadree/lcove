import {
  COMMUNITY_FUND_FEE_PERCENT,
  communityFundFeeCents,
} from "./fees.mjs";
import {
  invoiceSubscriptionId,
  isGrantEligible,
  mapMembershipStatus,
  subscriptionPeriodUnix,
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
    case "invoice.paid":
      await db.recordPaidInvoiceFee(event.data.object);
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
    await db.recordCheckoutCommunityFundFee(session, "network_subscription");
  }
  if (type === "studio_booking") {
    await db.recordCheckoutCommunityFundFee(session, "studio_booking");
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

function subtractDollars(current, delta) {
  const cents = Math.round(Number(current || 0) * 100) - Math.round(Number(delta || 0) * 100);
  return Math.max(0, cents) / 100;
}

async function listPages(list, params) {
  const rows = [];
  let startingAfter;
  for (let page = 0; page < 20; page += 1) {
    const result = await list({
      ...params,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const data = Array.isArray(result?.data) ? result.data : [];
    rows.push(...data);
    if (!result?.has_more || data.length === 0) break;
    const cursor = data[data.length - 1]?.id;
    if (!cursor || cursor === startingAfter) break;
    startingAfter = cursor;
  }
  return rows;
}

function paymentIntentFromInvoicePayment(row) {
  return idOf(row?.payment?.payment_intent);
}

// Basil (2025-03-31+) removed Invoice.payment_intent. Checkout Session still
// has payment_intent; an Invoice does not. A paid InvoicePayment is the link.
async function paidInvoicePaymentIntentId(stripe, invoice) {
  const legacy = idOf(invoice?.payment_intent);
  if (legacy) return legacy;
  const embedded = Array.isArray(invoice?.payments?.data) ? invoice.payments.data : [];
  for (const row of embedded) {
    if (row?.status === "canceled") continue;
    const id = paymentIntentFromInvoicePayment(row);
    if (id) return id;
  }
  if (!invoice?.id || typeof stripe?.invoicePayments?.list !== "function") return null;
  const rows = await listPages(
    (params) => stripe.invoicePayments.list(params),
    { invoice: invoice.id, status: "paid" },
  );
  for (const row of rows) {
    const id = paymentIntentFromInvoicePayment(row);
    if (id) return id;
  }
  return null;
}

// charge.refunded has not included refunds.data since 2022-11-15. List the
// Refund objects so a later partial refund has its own idempotency key.
async function refundParts(stripe, charge) {
  const embedded = Array.isArray(charge?.refunds?.data) ? charge.refunds.data : [];
  const fromEvent = embedded
    .filter((refund) => refund?.id && Number(refund.amount) > 0)
    .map((refund) => ({ id: refund.id, amountCents: Number(refund.amount) }));
  if (fromEvent.length) return fromEvent;

  if (charge?.id && typeof stripe?.refunds?.list === "function") {
    const rows = await listPages(
      (params) => stripe.refunds.list(params),
      { charge: charge.id },
    );
    const listed = rows
      .filter((refund) => refund?.id && Number(refund.amount) > 0)
      .map((refund) => ({ id: refund.id, amountCents: Number(refund.amount) }));
    if (listed.length) return listed;
  }

  const amountCents = Number(charge?.amount_refunded ?? 0);
  if (!charge?.id || !Number.isFinite(amountCents) || amountCents <= 0) return [];
  return [{ id: `charge:${charge.id}`, amountCents }];
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
        currentPeriodEnd = isoFromUnix(subscriptionPeriodUnix(sub).end);
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
        const period = subscriptionPeriodUnix(sub);
        if (period.start) periodStart = isoFromUnix(period.start);
        if (period.end) periodEnd = isoFromUnix(period.end);
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
          grant_eligible: isGrantEligible(lifetime),
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
        const period = subscriptionPeriodUnix(sub);
        if (period.start) periodStart = isoFromUnix(period.start);
        periodEnd = isoFromUnix(period.end);
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

    async recordCheckoutCommunityFundFee(session, sourceType) {
      const meta = session.metadata || {};
      const sourceId = sourceType === "studio_booking"
        ? meta.booking_id
        : (meta.network_id || idOf(session.subscription) || session.id);
      if (!sourceId) return;
      const fee = communityFundFeeCents(session.amount_total ?? 0) / 100;
      if (fee <= 0) return;
      // Checkout Session still carries invoice, subscription, and payment_intent
      // on 2025-08-27.basil. Those fields were removed from Invoice, Charge,
      // and PaymentIntent, not from the session.
      await insertCommunityFundFee(supabase, {
        source_type: sourceType,
        source_id: sourceId,
        amount: fee,
        credits_amount: 0,
        currency: session.currency || "usd",
        description: `Community fund fee (${COMMUNITY_FUND_FEE_PERCENT}%)`,
        stripe_session_id: session.id,
        stripe_invoice_id: idOf(session.invoice),
        stripe_payment_intent_id: idOf(session.payment_intent),
      });
      if (sourceType === "studio_booking") {
        await settleStudioBookingFee(supabase, sourceId, fee, idOf(session.payment_intent));
      }
    },

    async recordPaidInvoiceFee(invoice) {
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return;
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const meta = sub?.metadata || {};
      if (meta.type !== "network_subscription" && !meta.network_id) return;
      const fee = communityFundFeeCents(invoice.amount_paid ?? 0) / 100;
      if (fee <= 0) return;
      // Basil removed Invoice.payment_intent. The paid InvoicePayment still
      // points at the PaymentIntent, and the unique index dedupes on it.
      const paymentIntentId = await paidInvoicePaymentIntentId(stripe, invoice);
      await insertCommunityFundFee(supabase, {
        source_type: "network_subscription",
        source_id: meta.network_id || subscriptionId,
        amount: fee,
        credits_amount: 0,
        currency: invoice.currency || "usd",
        description: `Community fund fee (${COMMUNITY_FUND_FEE_PERCENT}%)`,
        stripe_invoice_id: invoice.id || null,
        stripe_payment_intent_id: paymentIntentId,
      });
    },

    async markInvoiceFailed(invoice) {
      const subId = invoiceSubscriptionId(invoice);
      if (!subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      await this.syncSubscription(sub, "invoice.payment_failed");
    },

    async syncSubscription(sub, eventType) {
      const period = subscriptionPeriodUnix(sub);
      const periodStart = isoFromUnix(period.start);
      const periodEnd = isoFromUnix(period.end);
      const failed = eventType === "invoice.payment_failed";
      const deleted = eventType === "customer.subscription.deleted";
      const artistStatus = failed
        ? "past_due"
        : (!deleted && (sub.status === "active" || sub.status === "trialing") ? "active" : "canceled");

      const artistPatch = {
        status: artistStatus,
        cancel_at_period_end: !!sub.cancel_at_period_end,
      };
      if (periodEnd) artistPatch.current_period_end = periodEnd;
      const { error: artistError } = await supabase
        .from("artist_subscriptions")
        .update(artistPatch)
        .eq("stripe_subscription_id", sub.id);
      throwIf(artistError);

      const meta = sub.metadata || {};
      const tier = tierFromStripeSubscription(sub);
      if (tier && meta.type !== "network_subscription") {
        let alreadyCancelled = false;
        if (deleted) {
          const { data: existing, error: readError } = await supabase
            .from("memberships")
            .select("status")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle();
          throwIf(readError);
          alreadyCancelled = existing?.status === "cancelled";
        }
        if (!alreadyCancelled) {
          const membershipPatch = {
            status: mapMembershipStatus(sub, eventType),
            tier,
            updated_at: new Date().toISOString(),
          };
          if (periodStart) membershipPatch.current_period_start = periodStart;
          if (periodEnd) membershipPatch.current_period_end = periodEnd;
          const { error } = await supabase
            .from("memberships")
            .update(membershipPatch)
            .eq("stripe_subscription_id", sub.id);
          throwIf(error);
        }
      }

      if (meta.network_id || meta.type === "network_subscription") {
        const networkStatus = failed
          ? "past_due"
          : (deleted ? "canceled" : (sub.status === "active" || sub.status === "trialing" ? "active" : sub.status || "canceled"));
        const networkPatch = { status: networkStatus };
        if (periodEnd) networkPatch.current_period_end = periodEnd;
        const { error } = await supabase
          .from("network_subscriptions")
          .update(networkPatch)
          .eq("stripe_subscription_id", sub.id);
        throwIf(error);
      }
    },

    async markChargeRefunded(charge) {
      const paymentIntentId = idOf(charge.payment_intent);
      if (paymentIntentId) {
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
      }
      await refundMembershipInvoice(supabase, stripe, charge);
    },
  };
}

async function insertCommunityFundFee(supabase, row) {
  const { error } = await supabase.from("community_fund_fees").insert(row);
  if (isUniqueViolation(error)) return false;
  throwIf(error);
  return true;
}

async function settleStudioBookingFee(supabase, bookingId, fee, paymentIntentId) {
  const { data: existing, error: readError } = await supabase
    .from("platform_treasury")
    .select("id")
    .eq("source_type", "studio_booking")
    .eq("source_id", bookingId)
    .maybeSingle();
  throwIf(readError);
  if (!existing) {
    const { error } = await supabase.from("platform_treasury").insert({
      source_type: "studio_booking",
      source_id: bookingId,
      amount: fee,
      credits_amount: 0,
      description: `Community fund fee (${COMMUNITY_FUND_FEE_PERCENT}%)`,
    });
    throwIf(error);
  }
  const patch = {
    status: "completed",
    platform_fee: fee,
  };
  if (paymentIntentId) patch.stripe_payment_intent_id = paymentIntentId;
  const { error: bookingError } = await supabase
    .from("studio_bookings")
    .update(patch)
    .eq("id", bookingId);
  throwIf(bookingError);
}

// Basil removed Charge.invoice and PaymentIntent.invoice. The InvoicePayment
// list filtered by that PaymentIntent is the supported lookup. A pre-basil
// event can still carry charge.invoice, which skips the extra request.
async function invoiceIdsForPaymentIntent(stripe, paymentIntentId) {
  if (!paymentIntentId || typeof stripe?.invoicePayments?.list !== "function") return [];
  const rows = await listPages(
    (params) => stripe.invoicePayments.list(params),
    {
      payment: { type: "payment_intent", payment_intent: paymentIntentId },
    },
  );
  const ranked = [
    ...rows.filter((row) => row?.status === "paid"),
    ...rows.filter((row) => row && row.status !== "paid" && row.status !== "canceled"),
  ];
  const ids = [];
  for (const row of ranked) {
    const invoiceId = idOf(row?.invoice);
    if (invoiceId && !ids.includes(invoiceId)) ids.push(invoiceId);
  }
  return ids;
}

async function membershipSubscriptionForCharge(stripe, charge) {
  const invoiceIds = [];
  const direct = idOf(charge?.invoice);
  if (direct) invoiceIds.push(direct);
  else invoiceIds.push(...await invoiceIdsForPaymentIntent(stripe, idOf(charge?.payment_intent)));
  if (!invoiceIds.length || typeof stripe?.invoices?.retrieve !== "function") return null;
  for (const invoiceId of invoiceIds) {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId || typeof stripe?.subscriptions?.retrieve !== "function") continue;
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (!tierFromStripeSubscription(sub)) continue;
    return { invoiceId, subscriptionId, sub };
  }
  return null;
}

async function refundMembershipInvoice(supabase, stripe, charge) {
  const context = await membershipSubscriptionForCharge(stripe, charge);
  if (!context) return;
  const { invoiceId, subscriptionId, sub } = context;

  const { data: membership, error: readError } = await supabase
    .from("memberships")
    .select("id, lifetime_contribution, tier, status")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  throwIf(readError);
  if (!membership) return;

  const parts = await refundParts(stripe, charge);
  const insertedIds = [];
  let applied = 0;
  try {
    for (const part of parts) {
      const amount = part.amountCents / 100;
      const { error } = await supabase.from("membership_payment_refunds").insert({
        stripe_refund_id: part.id,
        stripe_charge_id: charge.id || null,
        stripe_invoice_id: invoiceId,
        stripe_subscription_id: subscriptionId,
        membership_id: membership.id,
        amount,
      });
      if (isUniqueViolation(error)) continue;
      throwIf(error);
      insertedIds.push(part.id);
      applied += amount;
    }

    const lifetime = subtractDollars(membership.lifetime_contribution, applied);
    const { error: updateError } = await supabase
      .from("memberships")
      .update({
        lifetime_contribution: lifetime,
        status: "cancelled",
        grant_eligible: isGrantEligible(lifetime),
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.id);
    throwIf(updateError);

    if (applied > 0) {
      const { data: contribution, error: contributionReadError } = await supabase
        .from("membership_contributions")
        .select("id, amount")
        .eq("stripe_invoice_id", invoiceId)
        .maybeSingle();
      throwIf(contributionReadError);
      if (contribution) {
        const { error: contributionError } = await supabase
          .from("membership_contributions")
          .update({ amount: subtractDollars(contribution.amount, applied) })
          .eq("id", contribution.id);
        throwIf(contributionError);
      }
    }
  } catch (err) {
    for (const refundId of insertedIds) {
      await supabase.from("membership_payment_refunds").delete().eq("stripe_refund_id", refundId);
    }
    throw err;
  }

  if (sub.status !== "canceled" && sub.status !== "incomplete_expired" && stripe?.subscriptions?.cancel) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err?.code || err?.raw?.code;
      if (code === "resource_missing" || /already been canceled|canceled subscription/i.test(message)) return;
      throw err;
    }
  }
}
