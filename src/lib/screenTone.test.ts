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
    assert.equal(toneForPath("/nuance"), "cyan");
    assert.equal(toneForPath("/directory"), "cyan");
    assert.equal(toneForPath("/cinema"), "cyan");
  });
});
