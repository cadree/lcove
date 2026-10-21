import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countAt, easeOutCubic } from "./xpMotion.ts";

describe("xp count", () => {
  it("eases out and lands on the target", () => {
    assert.equal(easeOutCubic(0), 0);
    assert.equal(easeOutCubic(1), 1);
    assert.ok(easeOutCubic(0.5) > 0.5);
    assert.equal(countAt(0, 10, 0), 0);
    assert.equal(countAt(0, 10, 1), 10);
    assert.ok(countAt(0, 10, 0.5) > 5);
    assert.equal(countAt(8, 12, 1), 12);
  });
});