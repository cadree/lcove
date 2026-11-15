import { test } from "node:test";
import assert from "node:assert/strict";
import { coastStep, flingVelocity, type RotationSample } from "./globeInertia.ts";

const drag = (degPerMs: number, endAt = 1000): RotationSample[] =>
  Array.from({ length: 6 }, (_, i) => ({ t: endAt - (5 - i) * 16, rotation: [10 + degPerMs * i * 16, 0] }));

test("a flick keeps its speed and direction", () => {
  const v = flingVelocity(drag(0.3), 1010);
  assert.ok(v);
  assert.ok(Math.abs(v[0] - 0.3) < 1e-9 && v[1] === 0);
});

test("a finger that stopped before lifting does not coast", () => {
  assert.equal(flingVelocity(drag(0.3), 1100), null);
});

test("a slow drag does not coast", () => {
  assert.equal(flingVelocity(drag(0.005), 1005), null);
});

test("crossing the date line is a small step, not a spin the other way", () => {
  const samples: RotationSample[] = [{ t: 0, rotation: [178, 0] }, { t: 20, rotation: [-178, 0] }];
  const v = flingVelocity(samples, 25);
  assert.ok(v && v[0] > 0 && v[0] < 0.25);
});

test("very fast flicks are capped", () => {
  const v = flingVelocity(drag(5), 1000);
  assert.ok(v && Math.hypot(v[0], v[1]) <= 1.2 + 1e-9);
});

test("coasting slows down and stops, and stays inside the tilt limit", () => {
  let rotation: [number, number] = [0, 70];
  let velocity: [number, number] = [0.5, 0.2];
  let frames = 0;
  for (let going = true; going && frames < 1000; frames++) {
    const step = coastStep(rotation, velocity, 16);
    assert.ok(Math.hypot(...step.velocity) < Math.hypot(...velocity));
    assert.ok(step.rotation[1] <= 80 && step.rotation[0] >= -180 && step.rotation[0] <= 180);
    ({ rotation, velocity, going } = step);
  }
  assert.ok(frames > 10 && frames < 200, `stopped after ${frames} frames`);
});
