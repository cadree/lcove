import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MusicPurchaseError, resolveMusicPurchase } from "../../supabase/functions/_shared/music-purchase.mjs";

const track = { id: "t1", artist_user_id: "artist", price_cents: 999, is_published: true };
const rule = { id: "r1", artist_user_id: "artist", track_id: "t1", rule_type: "purchase", amount_cents: 499, is_active: true };
const run = (over: Record<string, unknown> = {}) =>
  resolveMusicPurchase({ track, rule: null, requestedRuleId: null, buyerId: "fan", alreadyPaid: false, ...over });

describe("resolveMusicPurchase", () => {
  it("charges the track price and pays the track's artist", () => {
    assert.deepEqual(run(), { artistUserId: "artist", amountCents: 999, accessRuleId: null });
  });
  it("uses a rule only when it belongs to this artist and track", () => {
    assert.deepEqual(run({ rule, requestedRuleId: "r1" }), { artistUserId: "artist", amountCents: 499, accessRuleId: "r1" });
    assert.deepEqual(run({ rule: { ...rule, track_id: null }, requestedRuleId: "r1" }).amountCents, 499);
    for (const bad of [
      { ...rule, artist_user_id: "someone-else" },
      { ...rule, track_id: "other-track" },
      { ...rule, is_active: false },
      { ...rule, rule_type: "subscription" },
    ]) {
      assert.throws(() => run({ rule: bad, requestedRuleId: "r1" }), MusicPurchaseError);
    }
    assert.throws(() => run({ rule: null, requestedRuleId: "missing" }), MusicPurchaseError);
  });
  it("refuses own tracks, unpublished tracks, repeat buys and no price", () => {
    assert.throws(() => run({ buyerId: "artist" }), /own track/);
    assert.throws(() => run({ track: { ...track, is_published: false } }), (e: MusicPurchaseError) => e.status === 404);
    assert.throws(() => run({ track: null }), /not found/);
    assert.throws(() => run({ alreadyPaid: true }), (e: MusicPurchaseError) => e.status === 409);
    assert.throws(() => run({ track: { ...track, price_cents: 0 } }), /doesn't have a price/);
    assert.throws(() => run({ track: { ...track, price_cents: 25 } }), /doesn't have a price/);
  });
});
