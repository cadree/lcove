// cspell:words ndotv
import { geoDistance } from "d3-geo";
import { FAN_RADIUS } from "./globeMarkers";
import { GLOBE_SCALE, GLOBE_SIZE, type Rotation } from "./globeView";

/** Surface normal · view direction: 1 at the centre of the disc, 0 on the limb, <0 on the far side. */
export function viewDot(point: [number, number], rotation: Rotation): number {
  return Math.cos(geoDistance(point, [-rotation[0], -rotation[1]]));
}

/**
 * How many pixels of a marker stick out toward the limb (away from the disc centre).
 * When the fan points inward, only the disc, badge and lower label count.
 */
export function outwardReach(xy: [number, number], globeR: number, fanned: boolean, heading: number): number {
  const [x, y] = xy;
  const cx = GLOBE_SIZE / 2;
  const cy = GLOBE_SIZE / 2;
  const dist = Math.hypot(x - cx, y - cy) || 1;
  const ox = (x - cx) / dist;
  const oy = (y - cy) / dist;
  const project = (px: number, py: number, r: number) => px * ox + py * oy + r;
  let reach = 17;
  reach = Math.max(reach, project(13, -13, 8.5));
  reach = Math.max(reach, project(0, 26, 8));
  if (fanned) reach = Math.max(reach, project(Math.cos(heading) * FAN_RADIUS, Math.sin(heading) * FAN_RADIUS, 12));
  return reach;
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

/** Fan arc heading: up when that stays on the disc, otherwise toward the globe centre. */
export function fanHeading(x: number, y: number, globeR: number, reach = FAN_RADIUS + 12): number {
  const up = -Math.PI / 2;
  const cx = GLOBE_SIZE / 2;
  const cy = GLOBE_SIZE / 2;
  const inward = Math.atan2(cy - y, cx - x);
  if (Math.hypot(x - cx, y - reach - cy) <= globeR - 2) return up;
  return inward;
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
