import { geoOrthographic, type GeoProjection } from "d3-geo";

/** The globe's camera: rotation [lambda, phi] in degrees and a zoom factor (1 = whole globe). */
export type Rotation = [number, number];

export const GLOBE_SIZE = 400;
export const GLOBE_SCALE = 178;
const MAX_TILT = 80;

export function globeProjection(rotation: Rotation, zoom: number): GeoProjection {
  return geoOrthographic()
    .rotate(rotation)
    .scale(GLOBE_SCALE * zoom)
    .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
    .clipAngle(90);
}

const clampTilt = (phi: number) => Math.max(-MAX_TILT, Math.min(MAX_TILT, phi));

/** The [lon, lat] under a point of the globe's 400x400 frame, or null off the globe's disc. */
export function pointAt(rotation: Rotation, zoom: number, xy: [number, number]): [number, number] | null {
  const scale = GLOBE_SCALE * zoom;
  if (Math.hypot(xy[0] - GLOBE_SIZE / 2, xy[1] - GLOBE_SIZE / 2) >= scale) return null;
  const p = globeProjection(rotation, zoom).invert?.(xy);
  return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
}

/**
 * The rotation that puts `anchor` (a [lon, lat]) under the screen point `target` at this zoom.
 * This keeps the place between your fingers under your fingers while you pinch or drag.
 *
 * It solves in screen space (Gauss-Newton with a numeric Jacobian, every step checked to get
 * closer), so it also behaves when the exact answer is out of reach: past the tilt limit or off
 * the edge of the disc the anchor gets as close to the finger as it can instead of the globe
 * spinning away. Falls back to `rotation` when the anchor is on the far side.
 */
export function anchorRotation(anchor: [number, number], target: [number, number], zoom: number, rotation: Rotation): Rotation {
  const miss = (r: Rotation) => {
    const xy = screenPoint(r, zoom, anchor);
    return xy ? [xy[0] - target[0], xy[1] - target[1]] : null;
  };
  let r: Rotation = [rotation[0], clampTilt(rotation[1])];
  let e = miss(r);
  if (!e) return rotation;
  const h = 1e-3;
  for (let i = 0; i < 16 && Math.hypot(e[0], e[1]) > 1e-3; i++) {
    const eLon = miss([r[0] + h, r[1]]);
    const eLat = miss([r[0], r[1] + h]);
    if (!eLon || !eLat) break;
    // Columns of the Jacobian d(screen)/d(rotation).
    const a = (eLon[0] - e[0]) / h, c = (eLon[1] - e[1]) / h;
    const b = (eLat[0] - e[0]) / h, d = (eLat[1] - e[1]) / h;
    const det = a * d - b * c;
    let step: Rotation;
    if (Math.abs(det) > 1e-9) step = [-(d * e[0] - b * e[1]) / det, -(-c * e[0] + a * e[1]) / det];
    else {
      const n = a * a + c * c;
      step = n > 1e-12 ? [-(a * e[0] + c * e[1]) / n, 0] : [0, 0];
    }
    const size = Math.hypot(e[0], e[1]);
    let moved = false;
    for (let k = 1; k >= 1 / 32; k /= 2) {
      const next: Rotation = [r[0] + step[0] * k, clampTilt(r[1] + step[1] * k)];
      const en = miss(next);
      if (en && Math.hypot(en[0], en[1]) < size) {
        r = next;
        e = en;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return [((((r[0] + 180) % 360) + 360) % 360) - 180, r[1]];
}

/** Where a [lon, lat] lands on screen, or null when it is on the far side. */
export function screenPoint(rotation: Rotation, zoom: number, point: [number, number]): [number, number] | null {
  const projection = globeProjection(rotation, zoom);
  const xy = projection(point);
  if (!xy) return null;
  const back = projection.invert?.(xy);
  // clipAngle(90) still projects far-side points; reject anything that does not round-trip.
  if (!back) return null;
  const dLon = Math.abs((((back[0] - point[0]) % 360) + 540) % 360 - 180);
  // Near the poles every longitude is the same place, so latitude decides there.
  if (Math.abs(back[1] - point[1]) > 1e-3 || (dLon > 1e-3 && Math.abs(point[1]) < 89.9)) return null;
  return [xy[0], xy[1]];
}
