import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { SELLER_SETUP_INCOMPLETE_MESSAGE, sellerSetupIncomplete } from "./sellerPaymentSetup.ts";
import { CREDIT_CASH_OUT_ENABLED, CREDIT_CASH_OUT_OFF_MESSAGE } from "./creditCashOut.ts";
import * as server from "../../supabase/functions/_shared/seller-payment-setup.mjs";
import * as payout from "../../supabase/functions/_shared/payout-request.mjs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("card sales need the seller's connected account", () => {
  it("uses one message on the client and the server", () => {
    assert.equal(server.SELLER_SETUP_INCOMPLETE_MESSAGE, SELLER_SETUP_INCOMPLETE_MESSAGE);
    assert.deepEqual(server.sellerSetupIncompleteBody(), { needs_connect: true, error: SELLER_SETUP_INCOMPLETE_MESSAGE });
  });

  it("recognizes the refusal and nothing else", () => {
    assert.equal(sellerSetupIncomplete(server.sellerSetupIncompleteBody()), true);
    assert.equal(sellerSetupIncomplete({ url: "https://checkout.stripe.com/x" }), false);
    assert.equal(sellerSetupIncomplete(null), false);
  });

  for (const fn of ["purchase-store-item", "purchase-event-ticket", "create-network-subscription", "purchase-studio-booking"]) {
    it(`${fn} refuses checkout without a connected account`, () => {
      const source = read(`supabase/functions/${fn}/index.ts`);
      assert.match(source, /sellerSetupIncompleteBody\(\)/);
      assert.doesNotMatch(source, /all funds go to platform/);
      assert.doesNotMatch(source, /"pending_setup"/);
    });
  }

  it("ticket checkout checks the host before writing an order", () => {
    const source = read("supabase/functions/purchase-event-ticket/index.ts");
    assert.ok(source.indexOf("sellerSetupIncompleteBody()") < source.indexOf('.from("ticket_orders")'));
  });

  it("guest store checkout checks the seller before reserving an order", () => {
    const source = read("supabase/functions/purchase-store-item/index.ts");
    assert.ok(source.indexOf("sellerSetupIncompleteBody()") < source.indexOf('"begin_guest_store_order"'));
  });
});

describe("credit cash-out stays off", () => {
  it("is off on the server and the client with one message", () => {
    assert.equal(payout.CREDIT_CASH_OUT_ENABLED, false);
    assert.equal(CREDIT_CASH_OUT_ENABLED, false);
    assert.equal(payout.CREDIT_CASH_OUT_OFF_MESSAGE, CREDIT_CASH_OUT_OFF_MESSAGE);
  });

  it("process-payout refuses before any Stripe call", () => {
    const source = read("supabase/functions/process-payout/index.ts");
    const guard = source.indexOf("if (!CREDIT_CASH_OUT_ENABLED)");
    assert.ok(guard > 0);
    assert.ok(guard < source.indexOf("testStripe()"));
    assert.ok(guard < source.indexOf("transfers.create"));
  });
});
