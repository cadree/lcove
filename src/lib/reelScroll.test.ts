import assert from "node:assert/strict";
import test from "node:test";
import { jumpToSlide, reelStartIndex } from "./reelScroll.ts";

test("the start index is clamped to a real reel", () => {
  assert.equal(reelStartIndex(0, 5), 0);
  assert.equal(reelStartIndex(3, 5), 3);
  assert.equal(reelStartIndex(9, 5), 4);
  assert.equal(reelStartIndex(-2, 5), 0);
  assert.equal(reelStartIndex(Number.NaN, 5), 0);
  assert.equal(reelStartIndex(2, 0), 0);
});

test("jumping turns snapping off, holds the position for a frame, then restores snapping", () => {
  const frames: Array<() => void> = [];
  const el = { scrollTop: 0, clientHeight: 844, style: { scrollSnapType: "" } };
  jumpToSlide(el, 3, (cb) => frames.push(cb));
  assert.equal(el.style.scrollSnapType, "none");
  assert.equal(el.scrollTop, 3 * 844);
  el.scrollTop = 0; // WebKit snapping back
  frames.shift()!();
  assert.equal(el.scrollTop, 3 * 844);
  assert.equal(el.style.scrollSnapType, "none");
  frames.shift()!();
  assert.equal(el.style.scrollSnapType, "");
  assert.equal(frames.length, 0);
});

test("two overlapping jumps still leave snapping on", () => {
  const frames: Array<() => void> = [];
  const el = { scrollTop: 0, clientHeight: 800, style: { scrollSnapType: "" } };
  jumpToSlide(el, 2, (cb) => frames.push(cb));
  jumpToSlide(el, 2, (cb) => frames.push(cb));
  while (frames.length) frames.shift()!();
  assert.equal(el.style.scrollSnapType, "");
  assert.equal(el.scrollTop, 1600);
});
