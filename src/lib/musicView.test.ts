import assert from "node:assert/strict";
import test from "node:test";
import {
  asLook, coverUploadProblem, dragSteps, isDjLicense, moveKey, orderKeys, recentFirst, releaseBadge, safeCoverOverrides, trackBadge,
} from "./musicView.ts";

const track = { id: "t1", price_cents: 299, is_published: true };
const viewer = { isOwner: false, hasAccess: false, iosApp: false };

test("hosted rows show price, DJ license, members or preview, the way checkout prices them", () => {
  assert.deepEqual(trackBadge(track, [], viewer), { label: "$2.99", tone: "price" });
  assert.equal(trackBadge(track, [], { ...viewer, iosApp: true }).label, "Exclusive");
  assert.equal(trackBadge(track, [{ rule_type: "purchase", amount_cents: 500, track_id: "t1" }], viewer).label, "$5.00");
  const dj = { rule_type: "purchase", label: "DJ license", amount_cents: 1500, track_id: "t1", metadata: { license: "dj" } };
  assert.equal(isDjLicense(dj), true);
  assert.deepEqual(trackBadge(track, [dj], viewer), { label: "DJ license $15.00", tone: "license" });
  const free = { ...track, price_cents: 0 };
  assert.equal(trackBadge(free, [{ rule_type: "subscription", amount_cents: 500, track_id: null }], viewer).label, "Subscribers");
  assert.equal(trackBadge(free, [], viewer).label, "Preview");
  assert.deepEqual(trackBadge({ ...free, access_type: "free" }, [{ rule_type: "subscription", amount_cents: 500 }], viewer), { label: "Free listening", tone: "free" });
  assert.equal(trackBadge(track, [], { ...viewer, hasAccess: true }).label, "Unlocked");
  assert.equal(trackBadge({ ...track, is_published: false }, [], { ...viewer, isOwner: true }).label, "Draft");
  assert.equal(releaseBadge("spotify").label, "Free on Spotify");
});

test("owner order wins, new music follows, and stale keys drop", () => {
  assert.deepEqual(orderKeys(["a", "b", "c"], ["c", "x", "a"]), ["c", "a", "b"]);
  assert.deepEqual(orderKeys(["a"], null), ["a"]);
  assert.deepEqual(moveKey(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveKey(["a", "b"], 0, 9), ["b", "a"]);
  assert.equal(dragSteps(20, 64), 0);
  assert.equal(dragSteps(40, 64), 1);
  assert.equal(dragSteps(-100, 64), -2);
});

test("recent puts the newest upload first", () => {
  const rows = recentFirst([
    { key: "r", kind: "release" as const, year: "2024" },
    { key: "t-old", kind: "track" as const, createdAt: "2026-01-01T00:00:00Z" },
    { key: "t-new", kind: "track" as const, createdAt: "2026-11-01T00:00:00Z" },
  ]);
  assert.deepEqual(rows.map((r) => r.key), ["t-new", "t-old", "r"]);
});

test("looks, covers and uploads are checked", () => {
  assert.equal(asLook("neon"), "neon");
  assert.equal(asLook("glitter"), "ether");
  assert.deepEqual(safeCoverOverrides({ a: "https://x/y.jpg", b: "http://no", c: 3 }), { a: "https://x/y.jpg" });
  assert.equal(coverUploadProblem({ size: 10, type: "image/png" }), null);
  assert.ok(coverUploadProblem({ size: 10, type: "audio/mpeg" }));
  assert.ok(coverUploadProblem({ size: 6 * 1024 * 1024, type: "image/jpeg" }));
});

test("the player gets the full file only with a signed URL, else the preview", async () => {
  const { playableTrack } = await import("./musicView.ts");
  const t = { id: "a", title: "A", artist_user_id: "u", preview_clip_url: "https://x/clip.mp3" };
  assert.equal(playableTrack(t, "Nova", null)?.previewOnly, true);
  assert.equal(playableTrack(t, "Nova", "https://signed/full.mp3")?.src, "https://signed/full.mp3");
  assert.equal(playableTrack({ ...t, preview_clip_url: null }, "Nova", null), null);
});
