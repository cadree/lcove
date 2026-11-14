import { test } from "node:test";
import assert from "node:assert/strict";
import { needsReveal, revealDelta, webKeyboardInset } from "./keyboardViewport.ts";
import { feedVideoSource } from "./videoWindow.ts";

test("keyboard height comes from the visual viewport, ignoring toolbar jitter", () => {
  assert.equal(webKeyboardInset(844, 508, 0), 336);
  assert.equal(webKeyboardInset(844, 508, 40), 296);
  assert.equal(webKeyboardInset(844, 780, 0), 0);
  assert.equal(webKeyboardInset(844, Number.NaN, 0), 0);
});

test("fields under the keyboard are revealed, visible ones are left alone", () => {
  assert.equal(needsReveal({ top: 631, bottom: 675 }, 0, 508), true);
  assert.equal(needsReveal({ top: 442, bottom: 492 }, 0, 508), false);
  assert.equal(needsReveal({ top: -20, bottom: 20 }, 0, 508), true);
  assert.equal(revealDelta({ top: 442, bottom: 492 }, 0, 508), 0);
  const delta = revealDelta({ top: 631, bottom: 675 }, 0, 508);
  const centre = (631 + 675) / 2 - delta;
  assert.ok(centre > 0 && centre < 508 - 24);
});

test("feed videos drop their source off screen and get an iOS first-frame hint", () => {
  assert.equal(feedVideoSource("https://cdn/v.mp4", false), undefined);
  assert.equal(feedVideoSource("https://cdn/v.mp4", true), "https://cdn/v.mp4#t=0.001");
  assert.equal(feedVideoSource("blob:abc", true), "blob:abc");
  assert.equal(feedVideoSource("https://cdn/v.mp4#t=2", true), "https://cdn/v.mp4#t=2");
  assert.equal(feedVideoSource(null, true), undefined);
});
