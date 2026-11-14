import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorRotation, pointAt, screenPoint, type Rotation } from "./globeView.ts";

const close = (a: [number, number] | null, b: [number, number], tol: number) =>
  !!a && Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;

test("the place under the fingers stays under them while zooming and dragging", () => {
  const start: Rotation = [80, -25];
  const fingers: [number, number] = [230, 240];
  const place = pointAt(start, 1, fingers)!;
  for (const zoom of [1.5, 3, 6, 12]) {
    const r = anchorRotation(place, fingers, zoom, start);
    assert.ok(close(screenPoint(r, zoom, place), fingers, 0.05), `zoom ${zoom}`);
  }
  // The fingers move while pinching: the place travels with their midpoint.
  const moved: [number, number] = [180, 205];
  const r = anchorRotation(place, moved, 2, start);
  assert.ok(close(screenPoint(r, 2, place), moved, 0.05));
});

test("dragging past the tilt limit or the edge gets close without spinning the globe", () => {
  const start: Rotation = [80, -25];
  const place = pointAt(start, 1, [200, 200])!;
  // Straight up past the pole: the tilt stops at its limit and the place stays near the finger column.
  const r = anchorRotation(place, [200, 20], 1, start);
  assert.ok(Math.abs(r[1]) <= 80);
  const xy = screenPoint(r, 1, place)!;
  assert.ok(Math.abs(xy[0] - 200) < 2, `x ${xy[0]}`);
  // Off the disc: the result is the best reachable point, not a jump away from the finger.
  const off: [number, number] = [395, 210];
  const r2 = anchorRotation(place, off, 1, start);
  const xy2 = screenPoint(r2, 1, place)!;
  assert.ok(xy2[0] > 300, `x ${xy2[0]}`);
});

test("points off the disc or on the far side have no screen spot", () => {
  assert.equal(pointAt([0, 0], 1, [5, 5]), null);
  assert.equal(screenPoint([0, 0], 1, [180, 0]), null);
  assert.ok(close(screenPoint([0, 0], 1, [0, 0]), [200, 200], 1e-6));
});
