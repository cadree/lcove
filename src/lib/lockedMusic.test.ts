// cspell:words noext
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAudioUpload } from "./audioFiles.ts";
import { fileExtension, lockedUploadProblems, MAX_LOCKED_AUDIO_BYTES, parsePriceCents, summarizeSales } from "./lockedMusic.ts";

const mp3 = { name: "song.mp3", type: "audio/mpeg", size: 8 * 1024 * 1024 };
const base = { title: "New song", audio: mp3, cover: null, price: "4.99", isAudio: isAudioUpload };

describe("parsePriceCents", () => {
  it("reads common price formats", () => {
    assert.equal(parsePriceCents("4.99"), 499);
    assert.equal(parsePriceCents("$5"), 500);
    assert.equal(parsePriceCents(" 1,000.5 "), 100050);
    assert.equal(parsePriceCents("4.999"), null);
    assert.equal(parsePriceCents("free"), null);
    assert.equal(parsePriceCents(""), null);
  });
});

describe("lockedUploadProblems", () => {
  it("accepts a normal phone upload", () => {
    assert.deepEqual(lockedUploadProblems(base), []);
    assert.deepEqual(lockedUploadProblems({ ...base, audio: { name: "Voice Memo.m4a", type: "", size: 1000 } }), []);
  });
  it("needs a title, an audio file under 50MB and a real price", () => {
    assert.deepEqual(lockedUploadProblems({ ...base, title: " " }), ["title"]);
    assert.deepEqual(lockedUploadProblems({ ...base, audio: null }), ["audio_missing"]);
    assert.deepEqual(lockedUploadProblems({ ...base, audio: { name: "clip.mov", type: "video/quicktime", size: 10 } }), ["audio_type"]);
    assert.deepEqual(lockedUploadProblems({ ...base, audio: { ...mp3, size: MAX_LOCKED_AUDIO_BYTES + 1 } }), ["audio_size"]);
    assert.deepEqual(lockedUploadProblems({ ...base, price: "0" }), ["price"]);
    assert.deepEqual(lockedUploadProblems({ ...base, price: "0.25" }), ["price"]);
    assert.deepEqual(lockedUploadProblems({ ...base, price: "" }), ["price"]);
    assert.deepEqual(lockedUploadProblems({ ...base, price: "501" }), ["price"]);
  });
  it("lets subscriber-only tracks skip the price", () => {
    assert.deepEqual(lockedUploadProblems({ ...base, price: "", hasSubscriptionRule: true }), []);
    assert.deepEqual(lockedUploadProblems({ ...base, price: "0.10", hasSubscriptionRule: true }), ["price"]);
  });
  it("checks cover art type and size", () => {
    assert.deepEqual(lockedUploadProblems({ ...base, cover: { name: "c.pdf", type: "application/pdf", size: 10 } }), ["cover_type"]);
    assert.deepEqual(lockedUploadProblems({ ...base, cover: { name: "c.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 } }), ["cover_size"]);
    assert.deepEqual(lockedUploadProblems({ ...base, cover: { name: "IMG_1.HEIC", type: "", size: 10 } }), []);
  });
});

describe("summarizeSales / fileExtension", () => {
  it("counts paid sales and refunds per track, ignoring pending and expired", () => {
    assert.deepEqual(summarizeSales([
      { track_id: "a", amount_cents: 499, payment_status: "paid" },
      { track_id: "a", amount_cents: 499, payment_status: "paid" },
      { track_id: "a", amount_cents: 499, payment_status: "refunded" },
      { track_id: "a", amount_cents: 499, payment_status: "pending" },
      { track_id: "b", amount_cents: 999, payment_status: "expired" },
    ]), { a: { sold: 2, grossCents: 998, refunded: 1 }, b: { sold: 0, grossCents: 0, refunded: 0 } });
  });
  it("keeps the real extension for downloads", () => {
    assert.equal(fileExtension("u/exclusive-1.FLAC"), "flac");
    assert.equal(fileExtension("https://x/y/z.m4a?token=1"), "m4a");
    assert.equal(fileExtension("noext"), "mp3");
  });
});
