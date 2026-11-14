import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EVENT_PLATFORM_FEE_PERCENT,
  STORE_PLATFORM_FEE_PERCENT,
  platformFeeCents,
  storeCashSplit,
} from "./fees.ts";

test("store cash split and event tickets share one fee table", async () => {
  const edge = await import("../../supabase/functions/_shared/fees.mjs");
  const split = storeCashSplit(4800, 500, 100);
  assert.equal(STORE_PLATFORM_FEE_PERCENT, edge.STORE_PLATFORM_FEE_PERCENT);
  assert.equal(EVENT_PLATFORM_FEE_PERCENT, edge.EVENT_PLATFORM_FEE_PERCENT);
  assert.equal(EVENT_PLATFORM_FEE_PERCENT, 0);
  assert.equal(platformFeeCents(2500, EVENT_PLATFORM_FEE_PERCENT), 0);
  assert.equal(split.platformFeeCents, Math.round(4800 * (STORE_PLATFORM_FEE_PERCENT / 100)));
  assert.equal(split.sellerCents, 4800 - split.platformFeeCents + 500 + 100);
  assert.deepEqual(edge.storeCashSplit(4800, 500, 100), split);

  const sql = readFileSync("supabase/migrations/20261024130000_anon_consumer_access.sql", "utf8");
  assert.doesNotMatch(sql, /\*\s*10\s*\/\s*100/);
  assert.match(sql, /p_platform_fee_cents/);
});
