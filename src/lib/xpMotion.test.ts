import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countAt, easeOutCubic, readoutAt } from "./xpMotion.ts";

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

  it("derives level and bar from the displayed XP", () => {
    const mid = readoutAt(12);
    assert.equal(mid.xp, 12);
    assert.equal(mid.level, 1);
    assert.equal(mid.into, 12);
    assert.equal(mid.span, 40);
    assert.equal(mid.ratio, 12 / 40);

    const atThreshold = readoutAt(40);
    assert.equal(atThreshold.xp, 40);
    assert.equal(atThreshold.level, 2);
    assert.equal(atThreshold.into, 0);
    assert.equal(atThreshold.span, 60);
    assert.equal(atThreshold.ratio, 0);

    const stillLevelOne = readoutAt(39.4);
    assert.equal(stillLevelOne.xp, 39);
    assert.equal(stillLevelOne.level, 1);
    assert.equal(stillLevelOne.into, 39);

    const justLevelTwo = readoutAt(39.6);
    assert.equal(justLevelTwo.xp, 40);
    assert.equal(justLevelTwo.level, 2);
    assert.equal(justLevelTwo.into, 0);
    assert.equal(justLevelTwo.span, 60);
  });
});