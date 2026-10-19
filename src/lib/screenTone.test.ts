import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toneForPath } from "./screenTone.ts";

describe("toneForPath", () => {
  it("assigns the approved tone to each main screen", () => {
    assert.equal(toneForPath("/"), "blood");
    assert.equal(toneForPath("/feed"), "crimson");
    assert.equal(toneForPath("/explore"), "cyan");
    assert.equal(toneForPath("/profile"), "pink");
    assert.equal(toneForPath("/profile/abc"), "pink");
    assert.equal(toneForPath("/messages"), "denim");
  });

  it("keeps explore destinations on the scan cyan tone", () => {
    assert.equal(toneForPath("/mall"), "cyan");
    assert.equal(toneForPath("/store"), "cyan");
    assert.equal(toneForPath("/nuance"), "cyan");
    assert.equal(toneForPath("/directory"), "cyan");
    assert.equal(toneForPath("/cinema"), "cyan");
    assert.equal(toneForPath("/calendar"), "cyan");
    assert.equal(toneForPath("/projects"), "cyan");
    assert.equal(toneForPath("/event/abc"), "cyan");
  });

  it("gives credits, reading, and alerts their own tones", () => {
    assert.equal(toneForPath("/wallet"), "gold");
    assert.equal(toneForPath("/fund"), "gold");
    assert.equal(toneForPath("/blog/abc"), "pink");
    assert.equal(toneForPath("/notifications"), "crimson");
    assert.equal(toneForPath("/messages/abc"), "denim");
  });
});
