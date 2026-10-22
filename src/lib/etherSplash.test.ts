import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POWER_MS, REDUCED_MS, splashFrame } from "./etherSplash.ts";

describe("splashFrame", () => {
  it("starts on the full logo and finishes inside a short power-on window", () => {
    const first = splashFrame(0, false);
    assert.equal(first.logo, 1);
    assert.equal(first.brightness, 1);
    assert.equal(first.veil, 1);
    assert.ok(POWER_MS >= 600 && POWER_MS <= 1000);
    const last = splashFrame(POWER_MS, false);
    assert.equal(last.veil, 0);
    assert.equal(last.logo, 1);
    const dip = splashFrame(180, false);
    assert.ok(dip.logo < 0.3);
    const bloom = splashFrame(500, false);
    assert.ok(bloom.brightness > 1);
    assert.equal(splashFrame(600, false).veil, 1);
  });

  it("fades without a flicker when motion is reduced", () => {
    assert.equal(splashFrame(0, true).logo, 1);
    assert.equal(splashFrame(100, true).brightness, 1);
    assert.ok(splashFrame(100, true).veil < 1);
    assert.equal(splashFrame(REDUCED_MS, true).veil, 0);
    assert.equal(splashFrame(REDUCED_MS, true).logo, 1);
  });
});
