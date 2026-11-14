/**
 * Two-finger pinch for anything drawn as `position = offset + scale * point`: the square photo
 * crop (offsets from the frame centre) and the board canvas (offsets from its top-left), in CSS px.
 */
export const CROP_MIN_SCALE = 1;
export const CROP_MAX_SCALE = 3;

export interface CropPinchStart {
  scale: number;
  offset: { x: number; y: number };
  /** Finger midpoint relative to the frame centre. */
  mid: { x: number; y: number };
  distance: number;
}

/**
 * The scale and offset that keep the part of the photo that was between the fingers
 * under the fingers, following both the spread and the midpoint as they move.
 */
export function cropPinch(
  start: CropPinchStart,
  mid: { x: number; y: number },
  distance: number,
  min = CROP_MIN_SCALE,
  max = CROP_MAX_SCALE
) {
  const raw = start.distance > 0 && distance > 0 ? start.scale * (distance / start.distance) : start.scale;
  const scale = Math.min(max, Math.max(min, raw));
  const k = scale / start.scale;
  return {
    scale,
    offset: {
      x: mid.x - (start.mid.x - start.offset.x) * k,
      y: mid.y - (start.mid.y - start.offset.y) * k,
    },
  };
}
