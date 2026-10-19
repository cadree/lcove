import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Stripe from "stripe";
import {
  createSupabaseStripeDb,
  handleSignedStripeWebhook,
} from "../supabase/functions/_shared/stripe-webhook-dispatch.mjs";
import { communityFundFeeCents } from "../supabase/functions/_shared/fees.mjs";
import {
  invoiceSubscriptionId,
  requireMembershipConfig,
  subscriptionPeriodUnix,
  tierFromStripeSubscription,
} from "../supabase/functions/_shared/membership-products.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webhookSecret = "whsec_local_fixture_not_a_real_secret";
const stripe = new Stripe("sk_test_local_fixture_not_a_real_secret", {
  apiVersion: "2025-08-27.basil",
});

function event(type, object) {
  return {
    id: `evt_${type}_${object.id || "1"}`,
    object: "event",
    type,
    data: { object },
  };
}

function sign(body) {
  const payload = JSON.stringify(body);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  return { payload, signature };
}

function makeDb({ claim = async () => true, failOn } = {}) {
  const calls = [];
  const db = new Proxy({}, {
    get(_target, prop) {
      if (prop === "claimEvent") {
        return async (...args) => {
          calls.push({ method: "claimEvent", args });
          return claim(...args);
        };
      }
      return async (...args) => {
        calls.push({ method: String(prop), args });
        if (prop === failOn) throw new Error("handler failed");
      };
    },
  });
  return { db, calls };
}

async function post(body, { signature, secret = webhookSecret, db } = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return handleSignedStripeWebhook({
    rawBody: payload,
    signature: signature === undefined ? sign(typeof body === "string" ? JSON.parse(body) : body).signature : signature,
    webhookSecret: secret,
    stripe,
    db,
  });
}

function methods(calls) {
  return calls.map((call) => call.method);
}

test("rejects a signature that was not made with the webhook secret", async () => {
  const body = event("checkout.session.completed", { id: "cs_bad", metadata: {} });
  const { db, calls } = makeDb();
  const signed = sign(body);
  const result = await handleSignedStripeWebhook({
    rawBody: signed.payload,
    signature: stripe.webhooks.generateTestHeaderString({
      payload: signed.payload,
      secret: "whsec_other_fixture",
    }),
    webhookSecret,
    stripe,
    db,
  });
  assert.equal(result.status, 400);
  assert.deepEqual(calls, []);
});

test("rejects a missing signature", async () => {
  const { db, calls } = makeDb();
  const result = await post(event("charge.refunded", { id: "ch_1", payment_intent: "pi_1" }), {
    signature: null,
    db,
  });
  assert.equal(result.status, 400);
  assert.deepEqual(calls, []);
});

test("membership checkout is recorded once from a signed event", async () => {
  const body = event("checkout.session.completed", {
    id: "cs_member",
    amount_total: 2500,
    currency: "usd",
    mode: "subscription",
    metadata: { type: "membership", tier: "elite", user_id: "user_1" },
    subscription: "sub_member",
    customer: "cus_1",
  });
  const { db, calls } = makeDb();
  const signed = sign(body);
  const verified = await stripe.webhooks.constructEventAsync(signed.payload, signed.signature, webhookSecret);
  assert.equal(verified.type, "checkout.session.completed");
  const result = await handleSignedStripeWebhook({
    rawBody: signed.payload,
    signature: signed.signature,
    webhookSecret,
    stripe,
    db,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.duplicate, undefined);
  assert.ok(methods(calls).includes("upsertMembershipFromCheckout"));
  assert.equal(methods(calls).includes("insertDonation"), false);
});

test("a donation is not treated as a membership", async () => {
  const body = event("checkout.session.completed", {
    id: "cs_gift",
    amount_total: 1000,
    currency: "usd",
    mode: "payment",
    metadata: { type: "fund_donation", source: "fund_donation", user_id: "guest" },
    payment_intent: "pi_gift",
  });
  const { db, calls } = makeDb();
  const result = await post(body, { db });
  assert.equal(result.status, 200);
  assert.ok(methods(calls).includes("insertDonation"));
  assert.equal(methods(calls).includes("upsertMembershipFromCheckout"), false);
});

test("store, ticket, network, music, and artist checkouts route apart", async () => {
  const cases = [
    [{ id: "cs_store", metadata: { order_id: "ord_1", item_id: "item_1", buyer_id: "user_1" } }, "confirmStoreOrder"],
    [{ id: "cs_ticket", metadata: { type: "event_ticket", order_id: "ord_t", event_id: "evt" } }, "confirmEventTicket"],
    [{ id: "cs_net", metadata: { network_id: "net_1", user_id: "user_1" }, subscription: "sub_n" }, "upsertNetworkSubscription"],
    [{ id: "cs_track", metadata: { type: "exclusive_track_purchase", track_id: "track_1", buyer_user_id: "user_1" } }, "recordExclusivePurchase"],
    [{ id: "cs_artist", metadata: { type: "artist_subscription", artist_user_id: "artist_1", subscriber_user_id: "user_1" }, subscription: "sub_a" }, "recordArtistSubscription"],
  ];
  for (const [object, method] of cases) {
    const { db, calls } = makeDb();
    const result = await post(event("checkout.session.completed", object), { db });
    assert.equal(result.status, 200, method);
    assert.ok(methods(calls).includes(method), method);
  }
});

test("an event ticket is not also confirmed as a store order", async () => {
  const { db, calls } = makeDb();
  await post(event("checkout.session.completed", {
    id: "cs_ticket_only",
    metadata: { type: "event_ticket", order_id: "ord_t", item_id: "not_a_store_item" },
  }), { db });
  assert.equal(methods(calls).includes("confirmStoreOrder"), false);
  assert.ok(methods(calls).includes("confirmEventTicket"));
});

test("expired store checkout cancels the pending order", async () => {
  const { db, calls } = makeDb();
  const result = await post(event("checkout.session.expired", {
    id: "cs_expired",
    metadata: { type: "store_order", order_id: "ord_x", item_id: "item_x" },
  }), { db });
  assert.equal(result.status, 200);
  assert.ok(methods(calls).includes("cancelPendingStoreOrder"));
});

test("an expired ticket is not also cancelled as a store order", async () => {
  const { db, calls } = makeDb();
  const result = await post(event("checkout.session.expired", {
    id: "cs_expired_ticket",
    metadata: { type: "event_ticket", order_id: "ord_t", item_id: "not_a_store_item" },
  }), { db });
  assert.equal(result.status, 200);
  assert.ok(methods(calls).includes("cancelPendingTicketOrder"));
  assert.equal(methods(calls).includes("cancelPendingStoreOrder"), false);
});

test("invoice failure, subscription deletion, and refunds are signed and routed", async () => {
  const cases = [
    [event("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }), "markInvoiceFailed"],
    [event("customer.subscription.deleted", { id: "sub_1", status: "canceled", metadata: { tier: "community", type: "membership" } }), "syncSubscription"],
    [event("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 500 }), "markChargeRefunded"],
  ];
  for (const [body, method] of cases) {
    const { db, calls } = makeDb();
    const result = await post(body, { db });
    assert.equal(result.status, 200, method);
    assert.ok(methods(calls).includes(method), method);
  }
});

test("a repeated event id is acknowledged and not applied again", async () => {
  const { db, calls } = makeDb({ claim: async () => false });
  const result = await post(event("checkout.session.completed", {
    id: "cs_dup",
    metadata: { type: "membership", tier: "community", user_id: "user_1" },
  }), { db });
  assert.equal(result.status, 200);
  assert.equal(result.body.duplicate, true);
  assert.deepEqual(methods(calls), ["claimEvent"]);
});

test("a handler failure returns non-200 and releases the event id", async () => {
  const { db, calls } = makeDb({ failOn: "insertDonation" });
  const result = await post(event("checkout.session.completed", {
    id: "cs_fail",
    metadata: { type: "fund_donation", user_id: "user_1" },
    amount_total: 500,
  }), { db });
  assert.equal(result.status, 500);
  assert.ok(methods(calls).includes("releaseEvent"));
});

function membershipEnv(overrides = {}) {
  const values = {
    STRIPE_PRODUCT_COMMUNITY: "prod_community_fixture",
    STRIPE_PRICE_COMMUNITY: "price_community_fixture",
    STRIPE_PRODUCT_ELITE: "prod_elite_fixture",
    STRIPE_PRICE_ELITE: "price_elite_fixture",
    ...overrides,
  };
  return { get: (name) => values[name] || "" };
}

test("membership config names every missing variable and has no built-in Stripe id", () => {
  const source = readFileSync(join(root, "supabase/functions/_shared/membership-products.mjs"), "utf8");
  assert.equal(source.includes("prod_"), false);
  assert.equal(source.includes("price_1"), false);
  assert.throws(
    () => requireMembershipConfig({ get: () => "" }),
    /membership not configured: missing STRIPE_PRODUCT_COMMUNITY, STRIPE_PRICE_COMMUNITY, STRIPE_PRODUCT_ELITE, STRIPE_PRICE_ELITE/,
  );
});

test("product id maps to the configured tier and a missing product secret fails closed", () => {
  const community = tierFromStripeSubscription({
    metadata: {},
    items: { data: [{ price: { product: "prod_community_fixture" } }] },
  }, membershipEnv());
  const elite = tierFromStripeSubscription({
    metadata: {},
    items: { data: [{ price: { product: "prod_elite_fixture" } }] },
  }, membershipEnv());
  const other = tierFromStripeSubscription({
    metadata: {},
    items: { data: [{ price: { product: "prod_other_account" } }] },
  }, membershipEnv());
  assert.equal(community, "community");
  assert.equal(elite, "elite");
  assert.equal(other, null);
  assert.throws(
    () => tierFromStripeSubscription({
      metadata: {},
      items: { data: [{ price: { product: "prod_other_account" } }] },
    }, membershipEnv({ STRIPE_PRODUCT_ELITE: "" })),
    /membership not configured: missing STRIPE_PRODUCT_ELITE/,
  );
});

test("metadata tier is used without a product secret", () => {
  assert.equal(tierFromStripeSubscription({
    metadata: { type: "membership", tier: "elite" },
    items: { data: [{ price: { product: "prod_from_another_account" } }] },
  }, { get: () => "" }), "elite");
  assert.equal(tierFromStripeSubscription({
    metadata: { type: "artist_subscription" },
    items: { data: [{ price: { product: "prod_artist" } }] },
  }, { get: () => "" }), null);
});

// Stripe API 2025-03-31.basil and later: the billing period is on the
// subscription item. The subscription object itself has no current_period_*.
function basilMembershipSubscription() {
  return {
    id: "sub_basil_elite",
    object: "subscription",
    status: "active",
    customer: "cus_basil",
    cancel_at_period_end: false,
    metadata: { type: "membership", tier: "elite", user_id: "user_1" },
    items: {
      object: "list",
      data: [
        {
          id: "si_basil_elite",
          object: "subscription_item",
          current_period_start: 1760908800,
          current_period_end: 1763500800,
          price: {
            id: "price_elite_fixture",
            object: "price",
            unit_amount: 2500,
            product: "prod_elite_fixture",
            recurring: { interval: "month" },
          },
        },
      ],
    },
  };
}

function memorySupabase() {
  const ops = [];
  function builder(table, op, payload) {
    const record = { table, op, payload, eq: [] };
    ops.push(record);
    const api = {
      select() {
        return api;
      },
      eq(column, value) {
        record.eq.push([column, value]);
        return api;
      },
      maybeSingle: async () => ({
        data: table === "memberships" && op === "upsert"
          ? { id: "mem_1", lifetime_contribution: 0 }
          : null,
        error: null,
      }),
      then(onFulfilled, onRejected) {
        const data = table === "membership_contributions" && op === "select"
          ? [{ amount: 25 }]
          : null;
        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };
    return api;
  }
  return {
    ops,
    from(table) {
      return {
        upsert: (payload) => builder(table, "upsert", payload),
        insert: (payload) => builder(table, "insert", payload),
        update: (payload) => builder(table, "update", payload),
        select: (payload) => builder(table, "select", payload),
      };
    },
  };
}

test("basil subscription periods are read from the item for checkout and subscription.updated", async () => {
  const sub = basilMembershipSubscription();
  assert.equal(sub.current_period_start, undefined);
  assert.equal(sub.current_period_end, undefined);
  const period = subscriptionPeriodUnix(sub);
  assert.deepEqual(period, { start: 1760908800, end: 1763500800 });

  const start = new Date(1760908800 * 1000).toISOString();
  const end = new Date(1763500800 * 1000).toISOString();
  assert.notEqual(start, end);

  const { ops, ...supabase } = memorySupabase();
  const stripeClient = {
    subscriptions: {
      retrieve: async (id) => {
        assert.equal(id, "sub_basil_elite");
        return sub;
      },
    },
  };
  const db = createSupabaseStripeDb(supabase, stripeClient);

  await db.upsertMembershipFromCheckout({
    id: "cs_basil_elite",
    amount_total: 2500,
    currency: "usd",
    mode: "subscription",
    customer: "cus_basil",
    subscription: "sub_basil_elite",
    invoice: "in_basil_elite",
    metadata: { type: "membership", tier: "elite", user_id: "user_1" },
  });

  const upsert = ops.find((op) => op.table === "memberships" && op.op === "upsert");
  assert.equal(upsert.payload.current_period_start, start);
  assert.equal(upsert.payload.current_period_end, end);
  assert.equal(upsert.payload.tier, "elite");
  assert.equal(upsert.payload.status, "active");
  assert.equal(upsert.payload.monthly_amount, 25);

  const contribution = ops.find((op) => op.table === "membership_contributions" && op.op === "insert");
  assert.equal(contribution.payload.period_start, start);
  assert.equal(contribution.payload.period_end, end);

  await db.syncSubscription(sub, "customer.subscription.updated");
  const synced = ops.filter((op) => op.table === "memberships" && op.op === "update").at(-1);
  assert.equal(synced.payload.current_period_start, start);
  assert.equal(synced.payload.current_period_end, end);
  assert.equal(synced.payload.status, "active");
  assert.equal(synced.payload.tier, "elite");
  assert.deepEqual(synced.eq, [["stripe_subscription_id", "sub_basil_elite"]]);
});

test("subscription period falls back to the top-level fields", () => {
  const legacy = {
    id: "sub_legacy",
    status: "active",
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    items: { data: [{ price: { unit_amount: 500 } }] },
  };
  assert.deepEqual(subscriptionPeriodUnix(legacy), {
    start: 1700000000,
    end: 1702592000,
  });

  const itemWins = {
    current_period_start: 10,
    current_period_end: 20,
    items: { data: [{ current_period_start: 100, current_period_end: 200 }] },
  };
  assert.deepEqual(subscriptionPeriodUnix(itemWins), { start: 100, end: 200 });
  assert.deepEqual(subscriptionPeriodUnix({ items: { data: [{}] } }), { start: null, end: null });
});

test("basil invoices expose the subscription id on parent", () => {
  assert.equal(invoiceSubscriptionId({
    id: "in_basil",
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: "sub_basil_elite" },
    },
  }), "sub_basil_elite");
  assert.equal(invoiceSubscriptionId({
    id: "in_legacy",
    subscription: "sub_legacy",
  }), "sub_legacy");
  const source = readFileSync(join(root, "supabase/functions/check-membership/index.ts"), "utf8");
  assert.match(source, /subscriptionPeriodUnix/);
  assert.match(source, /invoiceSubscriptionId/);
  assert.equal(source.includes("membershipSub.current_period_end"), false);
  assert.equal(source.includes("membershipSub.current_period_start"), false);
});

test("event, store, and community-fund fee constants match the edge function and the app", () => {
  const edge = readFileSync(join(root, "supabase/functions/_shared/fees.mjs"), "utf8");
  const app = readFileSync(join(root, "src/lib/fees.ts"), "utf8");
  for (const name of ["EVENT_PLATFORM_FEE_PERCENT", "STORE_PLATFORM_FEE_PERCENT", "COMMUNITY_FUND_FEE_PERCENT"]) {
    const pattern = new RegExp(`export const ${name} = (\\d+)`);
    assert.equal(edge.match(pattern)[1], app.match(pattern)[1], name);
  }
  assert.match(edge, /EVENT_PLATFORM_FEE_PERCENT = 0/);
  assert.match(edge, /STORE_PLATFORM_FEE_PERCENT = 10/);
  assert.match(edge, /COMMUNITY_FUND_FEE_PERCENT = 10/);
  assert.equal(communityFundFeeCents(1000), 100);
  assert.equal(communityFundFeeCents(0), 0);

  const network = readFileSync(join(root, "supabase/functions/create-network-subscription/index.ts"), "utf8");
  const studio = readFileSync(join(root, "supabase/functions/purchase-studio-booking/index.ts"), "utf8");
  assert.match(network, /application_fee_percent: COMMUNITY_FUND_FEE_PERCENT/);
  assert.match(studio, /COMMUNITY_FUND_FEE_PERCENT/);
  assert.equal(network.includes("= 20"), false);
  assert.equal(studio.includes("= 20"), false);
  assert.equal(studio.includes("* 0.80"), false);
});

function conflicts(table, rows, row) {
  if (table === "processed_stripe_events") {
    return rows.some((existing) => existing.event_id === row.event_id);
  }
  if (table === "membership_payment_refunds") {
    return rows.some((existing) => existing.stripe_refund_id === row.stripe_refund_id);
  }
  if (table === "community_fund_fees") {
    return rows.some((existing) => {
      if (existing.source_type !== row.source_type) return false;
      if (row.stripe_invoice_id && existing.stripe_invoice_id === row.stripe_invoice_id) return true;
      if (row.stripe_payment_intent_id && existing.stripe_payment_intent_id === row.stripe_payment_intent_id) return true;
      if (row.stripe_session_id && existing.stripe_session_id === row.stripe_session_id) return true;
      const offline = !row.stripe_invoice_id && !row.stripe_payment_intent_id && !row.stripe_session_id;
      const existingOffline = !existing.stripe_invoice_id && !existing.stripe_payment_intent_id && !existing.stripe_session_id;
      return offline && existingOffline && existing.source_id === row.source_id;
    });
  }
  return false;
}

function rowDb(seed = {}) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const get = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  function match(row, filters) {
    return filters.every(([column, value]) => row[column] === value);
  }
  function builder(table, op, payload) {
    const filters = [];
    const run = () => {
      const rows = get(table);
      if (op === "insert") {
        const incoming = Array.isArray(payload) ? payload : [payload];
        if (incoming.some((row) => conflicts(table, rows, row))) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        for (const row of incoming) rows.push({ ...row });
        return { data: incoming, error: null };
      }
      if (op === "update") {
        for (const row of rows) {
          if (match(row, filters)) Object.assign(row, payload);
        }
        return { data: null, error: null };
      }
      if (op === "delete") {
        tables.set(table, rows.filter((row) => !match(row, filters)));
        return { data: null, error: null };
      }
      return { data: rows.filter((row) => match(row, filters)), error: null };
    };
    const api = {
      select() { return api; },
      eq(column, value) {
        filters.push([column, value]);
        return api;
      },
      maybeSingle: async () => {
        const { data, error } = run();
        return { data: data?.[0] ?? null, error };
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(run()).then(onFulfilled, onRejected);
      },
    };
    return api;
  }
  return {
    rows(name) { return get(name); },
    from(table) {
      return {
        insert: (payload) => builder(table, "insert", payload),
        update: (payload) => builder(table, "update", payload),
        delete: () => builder(table, "delete", null),
        select: () => builder(table, "select", null),
        upsert: (payload) => builder(table, "insert", payload),
      };
    },
    rpc: async () => ({ error: null }),
  };
}

function stripeStub({ subscriptions = {}, invoices = {}, paymentIntents = {} } = {}) {
  const cancels = [];
  return {
    cancels,
    subscriptions: {
      retrieve: async (id) => {
        if (!subscriptions[id]) throw new Error(`missing subscription ${id}`);
        return subscriptions[id];
      },
      cancel: async (id) => {
        cancels.push(id);
        if (subscriptions[id]) subscriptions[id] = { ...subscriptions[id], status: "canceled" };
        return subscriptions[id];
      },
    },
    invoices: {
      retrieve: async (id) => {
        if (!invoices[id]) throw new Error(`missing invoice ${id}`);
        return invoices[id];
      },
    },
    paymentIntents: {
      retrieve: async (id) => paymentIntents[id] || { id, invoice: null },
    },
  };
}

function networkSubscription() {
  return {
    id: "sub_net",
    status: "active",
    metadata: { type: "network_subscription", network_id: "net_1", user_id: "user_1" },
    items: { data: [{ current_period_start: 1760908800, current_period_end: 1763500800 }] },
  };
}

function membershipSubscription() {
  return {
    id: "sub_member",
    status: "active",
    metadata: { type: "membership", tier: "elite", user_id: "user_1" },
    items: { data: [{ current_period_start: 1760908800, current_period_end: 1763500800, price: { unit_amount: 2500 } }] },
  };
}

test("network and studio payments record a 10% community-fund fee once", async () => {
  const db = rowDb();
  const stripeClient = stripeStub({ subscriptions: { sub_net: networkSubscription() } });
  const adapter = createSupabaseStripeDb(db, stripeClient);

  const networkSession = {
    id: "cs_net",
    amount_total: 1000,
    currency: "usd",
    invoice: "in_net",
    subscription: "sub_net",
    payment_intent: "pi_net",
    metadata: { type: "network_subscription", network_id: "net_1", user_id: "user_1" },
  };
  const first = await post(event("checkout.session.completed", networkSession), { db: adapter });
  assert.equal(first.status, 200);
  assert.equal(db.rows("community_fund_fees").length, 1);
  assert.equal(db.rows("community_fund_fees")[0].amount, 1);
  assert.equal(db.rows("community_fund_fees")[0].source_type, "network_subscription");

  const again = await post(event("checkout.session.completed", networkSession), { db: adapter });
  assert.equal(again.body.duplicate, true);
  assert.equal(db.rows("community_fund_fees").length, 1);

  const renewal = await post(event("invoice.paid", {
    id: "in_net_2",
    amount_paid: 1000,
    currency: "usd",
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_net" } },
  }), { db: adapter });
  assert.equal(renewal.status, 200);
  assert.equal(db.rows("community_fund_fees").length, 2);
  assert.equal(db.rows("community_fund_fees").reduce((sum, row) => sum + row.amount, 0), 2);

  const sameInvoice = await adapter.recordPaidInvoiceFee({
    id: "in_net",
    amount_paid: 1000,
    currency: "usd",
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_net" } },
  });
  assert.equal(sameInvoice, undefined);
  assert.equal(db.rows("community_fund_fees").filter((row) => row.stripe_invoice_id === "in_net").length, 1);

  await db.from("studio_bookings").insert({ id: "book_1", status: "approved" });
  const studio = await post(event("checkout.session.completed", {
    id: "cs_studio",
    amount_total: 5000,
    currency: "usd",
    payment_intent: "pi_studio",
    metadata: { type: "studio_booking", booking_id: "book_1" },
  }), { db: adapter });
  assert.equal(studio.status, 200);
  const studioFee = db.rows("community_fund_fees").find((row) => row.source_type === "studio_booking");
  assert.equal(studioFee.amount, 5);
  assert.equal(studioFee.source_id, "book_1");
  const booking = db.rows("studio_bookings").find((row) => row.id === "book_1");
  assert.equal(booking.status, "completed");
  assert.equal(booking.platform_fee, 5);
  assert.equal(db.rows("platform_treasury").length, 1);
  assert.equal(db.rows("platform_treasury")[0].amount, 5);

  const untouched = await post(event("checkout.session.completed", {
    id: "cs_ticket_fee",
    amount_total: 5000,
    metadata: { type: "event_ticket", order_id: "ord_t" },
  }), { db: adapter });
  assert.equal(untouched.status, 200);
  assert.equal(db.rows("community_fund_fees").some((row) => row.stripe_session_id === "cs_ticket_fee"), false);

  const membershipInvoice = await post(event("invoice.paid", {
    id: "in_member_fee",
    amount_paid: 2500,
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_member" } },
  }), {
    db: createSupabaseStripeDb(db, stripeStub({
      subscriptions: { sub_net: networkSubscription(), sub_member: membershipSubscription() },
    })),
  });
  assert.equal(membershipInvoice.status, 200);
  assert.equal(db.rows("community_fund_fees").some((row) => row.stripe_invoice_id === "in_member_fee"), false);
});

test("a refunded membership invoice cancels the membership and the Stripe subscription", async () => {
  const db = rowDb({
    memberships: [{
      id: "mem_1",
      stripe_subscription_id: "sub_member",
      lifetime_contribution: 30,
      tier: "elite",
      status: "active",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    membership_contributions: [{ id: "mc_1", stripe_invoice_id: "in_member", amount: 25 }],
  });
  const subscriptions = { sub_member: membershipSubscription() };
  const stripeClient = stripeStub({
    subscriptions,
    invoices: {
      in_member: {
        id: "in_member",
        amount_paid: 2500,
        parent: { type: "subscription_details", subscription_details: { subscription: "sub_member" } },
      },
    },
    paymentIntents: { pi_mem: { id: "pi_mem", invoice: "in_member" } },
  });
  const adapter = createSupabaseStripeDb(db, stripeClient);
  const charge = {
    id: "ch_mem",
    payment_intent: "pi_mem",
    amount: 2500,
    amount_refunded: 2500,
    refunds: { data: [{ id: "re_1", amount: 2500 }] },
  };

  const result = await post(event("charge.refunded", charge), { db: adapter });
  assert.equal(result.status, 200);
  const membership = db.rows("memberships")[0];
  assert.equal(membership.lifetime_contribution, 5);
  assert.equal(membership.status, "cancelled");
  assert.equal(db.rows("membership_contributions")[0].amount, 0);
  assert.deepEqual(stripeClient.cancels, ["sub_member"]);
  assert.equal(subscriptions.sub_member.status, "canceled");

  const duplicate = await post(event("charge.refunded", charge), { db: adapter });
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 5);
  assert.deepEqual(stripeClient.cancels, ["sub_member"]);

  await adapter.markChargeRefunded(charge);
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 5);
  assert.equal(db.rows("memberships")[0].status, "cancelled");
  assert.deepEqual(stripeClient.cancels, ["sub_member"]);

  const stamped = db.rows("memberships")[0].updated_at;
  const deleted = await post(event("customer.subscription.deleted", {
    ...subscriptions.sub_member,
    status: "canceled",
  }), { db: adapter });
  assert.equal(deleted.status, 200);
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 5);
  assert.equal(db.rows("memberships")[0].status, "cancelled");
  assert.equal(db.rows("memberships")[0].updated_at, stamped);
  assert.deepEqual(stripeClient.cancels, ["sub_member"]);
});

test("a membership refund never drops lifetime contribution below zero", async () => {
  const db = rowDb({
    memberships: [{
      id: "mem_1",
      stripe_subscription_id: "sub_member",
      lifetime_contribution: 10,
      tier: "community",
      status: "active",
    }],
    membership_contributions: [{ id: "mc_1", stripe_invoice_id: "in_member", amount: 8 }],
  });
  const stripeClient = stripeStub({
    subscriptions: { sub_member: membershipSubscription() },
    invoices: {
      in_member: { id: "in_member", subscription: "sub_member" },
    },
  });
  const adapter = createSupabaseStripeDb(db, stripeClient);
  await adapter.markChargeRefunded({
    id: "ch_big",
    invoice: "in_member",
    payment_intent: "pi_big",
    amount_refunded: 2500,
    refunds: { data: [{ id: "re_big", amount: 2500 }] },
  });
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 0);
  assert.equal(db.rows("memberships")[0].status, "cancelled");
  assert.equal(db.rows("membership_contributions")[0].amount, 0);
  assert.deepEqual(stripeClient.cancels, ["sub_member"]);
});

test("a second membership refund subtracts only the new amount", async () => {
  const db = rowDb({
    memberships: [{
      id: "mem_1",
      stripe_subscription_id: "sub_member",
      lifetime_contribution: 40,
      tier: "community",
      status: "active",
    }],
    membership_contributions: [{ id: "mc_1", stripe_invoice_id: "in_member", amount: 40 }],
  });
  const subscriptions = { sub_member: membershipSubscription() };
  const stripeClient = stripeStub({
    subscriptions,
    invoices: { in_member: { id: "in_member", subscription: "sub_member" } },
  });
  const adapter = createSupabaseStripeDb(db, stripeClient);
  await adapter.markChargeRefunded({
    id: "ch_part",
    invoice: "in_member",
    payment_intent: "pi_part",
    amount_refunded: 1000,
    refunds: { data: [{ id: "re_a", amount: 1000 }] },
  });
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 30);
  await adapter.markChargeRefunded({
    id: "ch_part",
    invoice: "in_member",
    payment_intent: "pi_part",
    amount_refunded: 2500,
    refunds: { data: [{ id: "re_a", amount: 1000 }, { id: "re_b", amount: 1500 }] },
  });
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 15);
  assert.equal(db.rows("membership_contributions")[0].amount, 15);
  assert.equal(db.rows("memberships")[0].status, "cancelled");
});

test("a network-subscription refund does not cancel a membership", async () => {
  const db = rowDb({
    memberships: [{
      id: "mem_1",
      stripe_subscription_id: "sub_member",
      lifetime_contribution: 30,
      tier: "elite",
      status: "active",
    }],
  });
  const stripeClient = stripeStub({
    subscriptions: { sub_net: networkSubscription() },
    invoices: { in_net: { id: "in_net", subscription: "sub_net" } },
  });
  const adapter = createSupabaseStripeDb(db, stripeClient);
  await adapter.markChargeRefunded({
    id: "ch_net",
    invoice: "in_net",
    payment_intent: "pi_net",
    amount_refunded: 1000,
    refunds: { data: [{ id: "re_net", amount: 1000 }] },
  });
  assert.equal(db.rows("memberships")[0].status, "active");
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 30);
  assert.deepEqual(stripeClient.cancels, []);
  assert.equal(db.rows("membership_payment_refunds").length, 0);
});

test("customer.subscription.deleted still cancels an active membership and leaves lifetime alone", async () => {
  const db = rowDb({
    memberships: [{
      id: "mem_1",
      stripe_subscription_id: "sub_member",
      lifetime_contribution: 40,
      tier: "community",
      status: "active",
    }],
  });
  const adapter = createSupabaseStripeDb(db, stripeStub());
  await adapter.syncSubscription({
    ...membershipSubscription(),
    status: "canceled",
  }, "customer.subscription.deleted");
  assert.equal(db.rows("memberships")[0].status, "cancelled");
  assert.equal(db.rows("memberships")[0].lifetime_contribution, 40);
});
