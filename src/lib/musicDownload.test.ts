import assert from "node:assert/strict";
import test from "node:test";
import { canDownloadMusic } from "../../supabase/functions/_shared/music-download.mjs";

test("downloads need the artist's permission and a real paid track purchase", () => {
  const track = { id: "t", access_type: "purchase", allow_downloads: true };
  const purchase = { track_id: "t", buyer_user_id: "fan", payment_status: "paid", amount_cents: 50 };
  assert.equal(canDownloadMusic(track, purchase, "fan"), true);
  for (const payment_status of ["pending", "failed", "refunded", "expired"]) {
    assert.equal(canDownloadMusic(track, { ...purchase, payment_status }, "fan"), false);
  }
  assert.equal(canDownloadMusic(track, { ...purchase, amount_cents: 0 }, "fan"), false);
  assert.equal(canDownloadMusic(track, null, "fan"), false); // subscription or free listening
  assert.equal(canDownloadMusic(track, purchase, "another-fan"), false);
  assert.equal(canDownloadMusic(track, { ...purchase, track_id: "other" }, "fan"), false);
  assert.equal(canDownloadMusic({ ...track, allow_downloads: false }, purchase, "fan"), false);
  assert.equal(canDownloadMusic({ ...track, access_type: "free" }, purchase, "fan"), false);
});
