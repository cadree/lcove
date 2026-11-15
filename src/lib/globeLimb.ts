// cspell:words ndotv
import { geoDistance } from "d3-geo";
import { CARD } from "./globeMarkers.ts";
import { GLOBE_SCALE, GLOBE_SIZE, type Rotation } from "./globeView.ts";

/** Surface normal · view direction: 1 at the centre of the disc, 0 on the limb, <0 on the far side. */
export function viewDot(point: [number, number], rotation: Rotation): number {
  return Math.cos(geoDistance(point, [-rotation[0], -rotation[1]]));
}

/**
 * How many pixels of a city card stick out toward the limb (away from the disc centre):
 * the card above its anchor, the count badge on its corner and the "N cities" pill below.
 */
export function outwardReach(xy: [number, number]): number {
  const [x, y] = xy;
  const cx = GLOBE_SIZE / 2;
  const cy = GLOBE_SIZE / 2;
  const dist = Math.hypot(x - cx, y - cy) || 1;
  const ox = (x - cx) / dist;
  const oy = (y - cy) / dist;
  const project = (px: number, py: number, r = 0) => px * ox + py * oy + r;
  const half = CARD.w / 2;
  const top = -(CARD.h + CARD.lift);
  return Math.max(
    project(-half, top), project(half, top), project(-half, -CARD.lift), project(half, -CARD.lift),
    project(half - 2, top + 2, CARD.badge),
    project(-22, 21), project(22, 21),
  );
}

/** Smooth fade: 1 when the whole footprint is on the disc, 0 at or past the limb. */
export function limbOpacity(ndotv: number, globeR: number, outwardPx: number, fadePx = 20): number {
  if (!(ndotv > 0) || globeR <= 0) return 0;
  const radial = globeR * Math.sqrt(Math.max(0, 1 - ndotv * ndotv));
  const room = globeR - radial;
  if (room <= outwardPx) return 0;
  if (room >= outwardPx + fadePx) return 1;
  const t = (room - outwardPx) / fadePx;
  return t * t * (3 - 2 * t);
}

/** Tighter clip angle so zoomed-in land only covers the visible cap, not the whole hemisphere. */
export function detailClipAngle(zoom: number, size = GLOBE_SIZE, scale = GLOBE_SCALE): number {
  const r = scale * zoom;
  const half = Math.hypot(size / 2, size / 2);
  if (r <= half) return 90;
  return Math.min(90, (Math.asin(Math.min(1, half / r)) * 180) / Math.PI + 8);
}

export function onDisc(xy: [number, number], globeR: number, pad = 0): boolean {
  return Math.hypot(xy[0] - GLOBE_SIZE / 2, xy[1] - GLOBE_SIZE / 2) <= globeR - pad;
}
