import type { Rotation } from "./globeView.ts";

/** A rotation the globe was turned to during a drag, and when (performance.now()). */
export type RotationSample = { t: number; rotation: Rotation };

/** Degrees per millisecond, [longitude, latitude]. */
export type Velocity = [number, number];

/** Only the last stretch of a drag says how fast the finger left. */
const WINDOW_MS = 100;
/** A finger that stopped this long before lifting was a place-and-let-go, not a flick. */
const HELD_MS = 60;
/** Slower than this (deg/ms, about 20 deg/s) is not worth coasting. */
const MIN_SPEED = 0.02;
/** Faster flicks are capped so one swipe cannot spin the planet around several times. */
const MAX_SPEED = 1.2;
/** Coasting stops below this speed. */
const STOP_SPEED = 0.004;
/** Time constant of the slow-down; iOS scroll views feel close to this. */
const TAU_MS = 325;
const MAX_TILT = 80;

/** Shortest signed difference between two longitudes, so 179 -> -179 is +2, not -358. */
const lonDelta = (from: number, to: number) => ((((to - from + 540) % 360) + 360) % 360) - 180;

/** How fast the globe was turning when the finger lifted, or null when it should just stop. */
export function flingVelocity(samples: RotationSample[], now: number): Velocity | null {
  const last = samples.at(-1);
  if (!last || now - last.t > HELD_MS) return null;
  const first = samples.find((s) => last.t - s.t <= WINDOW_MS) ?? last;
  const dt = last.t - first.t;
  if (dt < 8) return null;
  let v: Velocity = [lonDelta(first.rotation[0], last.rotation[0]) / dt, (last.rotation[1] - first.rotation[1]) / dt];
  const speed = Math.hypot(v[0], v[1]);
  if (!Number.isFinite(speed) || speed < MIN_SPEED) return null;
  if (speed > MAX_SPEED) v = [(v[0] * MAX_SPEED) / speed, (v[1] * MAX_SPEED) / speed];
  return v;
}

/** One frame of coasting: move by the velocity, then slow it down. `going` is false once it has stopped. */
export function coastStep(rotation: Rotation, velocity: Velocity, dt: number): { rotation: Rotation; velocity: Velocity; going: boolean } {
  const lat = Math.max(-MAX_TILT, Math.min(MAX_TILT, rotation[1] + velocity[1] * dt));
  // At the tilt limit the up-down part of the motion is spent; the spin carries on.
  const vLat = Math.abs(lat) >= MAX_TILT ? 0 : velocity[1];
  const lon = ((((rotation[0] + velocity[0] * dt + 180) % 360) + 360) % 360) - 180;
  const decay = Math.exp(-dt / TAU_MS);
  const next: Velocity = [velocity[0] * decay, vLat * decay];
  return { rotation: [lon, lat], velocity: next, going: Math.hypot(next[0], next[1]) >= STOP_SPEED };
}
