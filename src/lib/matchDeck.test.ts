import assert from "node:assert/strict";
import test from "node:test";
import { BEHIND, PEEK_PX, isSideways, pagerDots, stackPose, swipeTarget } from "./matchDeck.ts";

test("cards behind lift and shrink, and the front card sits on top", () => {
  const front = stackPose(0);
  assert.equal(front.opacity, 1);
  assert.match(front.transform, /translate3d\(0, 0px, 0\) scale\(1\.000\)/);
  const back = stackPose(2);
  assert.match(back.transform, new RegExp(`-${2 * PEEK_PX}px`));
  assert.ok(back.zIndex < front.zIndex);
  // Deeper than the stack shows clamps to the last visible pose.
  assert.deepEqual(stackPose(BEHIND + 4), stackPose(BEHIND));
});

test("a short drag stays put; a long one moves one card and never past the ends", () => {
  assert.equal(swipeTarget(-20, 2, 5), 2);
  assert.equal(swipeTarget(-90, 2, 5), 3);
  assert.equal(swipeTarget(90, 2, 5), 1);
  assert.equal(swipeTarget(90, 0, 5), 0);
  assert.equal(swipeTarget(-90, 4, 5), 4);
});

test("only a clearly sideways move drags the card, so the page still scrolls", () => {
  assert.equal(isSideways(4, 0), false);
  assert.equal(isSideways(20, 30), false);
  assert.equal(isSideways(30, 10), true);
});

test("the pager shows at most five dots and keeps the active one inside", () => {
  assert.deepEqual(pagerDots(0, 3).dots, [0, 1, 2]);
  assert.deepEqual(pagerDots(9, 12).dots, [7, 8, 9, 10, 11]);
  assert.deepEqual(pagerDots(5, 12).dots, [3, 4, 5, 6, 7]);
});
