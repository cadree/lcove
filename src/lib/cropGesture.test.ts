import { test } from "node:test";
import assert from "node:assert/strict";
import { CROP_MAX_SCALE, cropPinch } from "./cropGesture.ts";

// Where a point of the photo (in unscaled photo px from its centre) is drawn.
const drawn = (view: { scale: number; offset: { x: number; y: number } }, p: { x: number; y: number }) => ({
  x: view.offset.x + p.x * view.scale,
  y: view.offset.y + p.y * view.scale,
});

test("a crop pinch scales with the spread and keeps the photo under the fingers", () => {
  const start = { scale: 1.2, offset: { x: 10, y: -5 }, mid: { x: 30, y: 20 }, distance: 80 };
  const under = { x: (start.mid.x - start.offset.x) / start.scale, y: (start.mid.y - start.offset.y) / start.scale };
  const mid = { x: 45, y: 10 };
  const next = cropPinch(start, mid, 120);
  assert.ok(Math.abs(next.scale - 1.8) < 1e-9);
  const at = drawn(next, under);
  assert.ok(Math.hypot(at.x - mid.x, at.y - mid.y) < 1e-9);
});

test("crop pinch is clamped, and custom limits serve the board canvas", () => {
  const start = { scale: 2, offset: { x: 0, y: 0 }, mid: { x: 0, y: 0 }, distance: 50 };
  assert.equal(cropPinch(start, { x: 0, y: 0 }, 500).scale, CROP_MAX_SCALE);
  assert.equal(cropPinch(start, { x: 0, y: 0 }, 5).scale, 1);
  assert.equal(cropPinch(start, { x: 0, y: 0 }, 5, 0.25, 3).scale, 0.25);
  assert.equal(cropPinch({ ...start, distance: 0 }, { x: 0, y: 0 }, 40).scale, 2);
});
