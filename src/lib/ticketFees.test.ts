import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applicationFeeCents,
  buyerUnitCents,
  formatUsd,
  hostNetCents,
  tierPriceLabel,
} from "./ticketFees.ts";
import {
  applicationFeeCents as serverApplicationFee,
  buyerUnitCents as serverBuyer,
  hostNetCents as serverHostNet,
  tierPriceLabel as serverLabel,
} from "../../supabase/functions/_shared/ticket-fees.mjs";

describe("ticket card fees", () => {
  it("shows the card fee inside the buyer price and leaves the host the listed amount", () => {
    const buyer = buyerUnitCents(2000, false);
    const fee = buyer - 2000;
    assert.equal(hostNetCents(2000, false), 2000);
    assert.equal(applicationFeeCents(2000, false), fee);
    assert.equal(buyer, serverBuyer(2000, false));
    assert.equal(tierPriceLabel(2000, false), `${formatUsd(buyer)} incl. ${formatUsd(fee)} fees`);
    assert.match(tierPriceLabel(2000, false), /incl\. \$/);
    assert.equal(tierPriceLabel(0, false), "Free");
  });

  it("lets the host absorb the card fee without an Ether platform cut", () => {
    assert.equal(buyerUnitCents(2000, true), 2000);
    assert.ok(hostNetCents(2000, true) < 2000);
    assert.equal(hostNetCents(2000, true), serverHostNet(2000, true));
    assert.equal(applicationFeeCents(2000, true), serverApplicationFee(2000, true));
    assert.equal(tierPriceLabel(2000, true), "$20.00");
    assert.equal(serverLabel(2000, false), tierPriceLabel(2000, false));
  });

  it("keeps the client and edge copies the same", () => {
    const client = readFileSync(new URL("./ticketFees.ts", import.meta.url), "utf8");
    const server = readFileSync(new URL("../../supabase/functions/_shared/ticket-fees.mjs", import.meta.url), "utf8");
    assert.match(client, /CARD_PERCENT = 0\.029/);
    assert.match(server, /CARD_PERCENT = 0\.029/);
    assert.match(client, /CARD_FIXED_CENTS = 30/);
    assert.match(server, /CARD_FIXED_CENTS = 30/);
  });
});
