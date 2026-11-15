import { test } from "node:test";
import assert from "node:assert/strict";
import { FAN_RADIUS } from "./globeMarkers.ts";
import { GLOBE_SCALE, GLOBE_SIZE } from "./globeView.ts";
import { detailClipAngle, fanHeading, limbOpacity, outwardReach, viewDot } from "./globeLimb.ts";

test("viewDot is 1 at the centre, 0 on the limb, and negative on the far side", () => {
  const rotation: [number, number] = [80, -25];
  const center: [number, number] = [-80, 25];
  assert.ok(Math.abs(viewDot(center, rotation) - 1) < 1e-9);
  assert.ok(viewDot([-80, 25 - 90], rotation) < 0.02);
  assert.ok(viewDot([-80, 25 + 90], rotation) < 0.02);
  assert.ok(viewDot([-80, 25 + 140], rotation) < 0);
});

test("limbOpacity hides a marker once its footprint would leave the disc, and is 1 at the centre", () => {
  assert.equal(limbOpacity(1, 178, 55), 1);
  assert.equal(limbOpacity(0, 178, 17), 0);
  assert.equal(limbOpacity(-0.2, 178, 17), 0);
  // A point very near the limb has almost no room, so a 55px fan is hidden.
  const nearLimb = 0.05;
  assert.equal(limbOpacity(nearLimb, 178, 55), 0);
  // In the fade band the opacity eases from 0 to 1 (not a hard cut).
  const mid = limbOpacity(0.55, 178, 20, 20);
  assert.ok(mid > 0 && mid < 1, `got ${mid}`);
});

test("fanHeading stays up when the arc fits, and turns inward near the top limb", () => {
  const up = -Math.PI / 2;
  assert.equal(fanHeading(200, 200, 178), up);
  const top = fanHeading(200, 200 - 170, 178);
  assert.ok(Math.abs(top - Math.PI / 2) < 0.2, `expected inward (down), got ${top}`);
});

test("outwardReach shrinks when the fan is flipped inward", () => {
  const top: [number, number] = [200, 40];
  const up = outwardReach(top, 178, true, -Math.PI / 2);
  const inw = outwardReach(top, 178, true, Math.PI / 2);
  assert.ok(up > FAN_RADIUS, `upward reach ${up}`);
  assert.ok(inw < up - 20, `inward ${inw} should be tighter than upward ${up}`);
});

test("detailClipAngle is the full hemisphere at world view and tightens when zoomed in", () => {
  assert.equal(detailClipAngle(1), 90);
  const tight = detailClipAngle(12);
  assert.ok(tight < 20 && tight > 8, `got ${tight}`);
  assert.ok(detailClipAngle(6) < 90);
  assert.ok(GLOBE_SCALE * 12 > GLOBE_SIZE);
});
