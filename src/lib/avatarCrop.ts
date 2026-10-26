/** Largest side of the JPEG stored as a profile photo. */
export const AVATAR_MAX_SIDE = 1024;

/** Matches the HEIC conversion quality so a cropped photo stays sharp. */
export const AVATAR_JPEG_QUALITY = 0.92;

/** Zoom 1 fills the square. Higher values move the frame closer. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export type CropInput = {
  imageWidth: number;
  imageHeight: number;
  /** Side of the fixed square, in the same pixels as the drag deltas. */
  frameSize: number;
  zoom: number;
  /**
   * Image shift from center, from -1 to 1.
   * Positive pan moves the photo right or down, so the square shows
   * a point further toward the top or left of the photo.
   */
  panX: number;
  panY: number;
};

export type CropGeometry = {
  zoom: number;
  panX: number;
  panY: number;
  /** Image shift from center, in frame pixels. */
  offsetX: number;
  offsetY: number;
  /** Source square, in image pixels. */
  x: number;
  y: number;
  size: number;
  /** Drawn photo box inside the frame, in frame pixels. */
  displayWidth: number;
  displayHeight: number;
  left: number;
  top: number;
};

function positive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function clampPan(pan: number): number {
  if (!Number.isFinite(pan)) return 0;
  return Math.min(1, Math.max(-1, pan));
}

/** Pixel side of the saved JPEG. Never enlarges a smaller crop. */
export function avatarOutputSide(sourceSize: number, maxSide = AVATAR_MAX_SIDE): number {
  if (!Number.isFinite(sourceSize) || sourceSize <= 0) return 1;
  if (!Number.isFinite(maxSide) || maxSide <= 0) return 1;
  return Math.max(1, Math.round(Math.min(maxSide, sourceSize)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Square the user is framing. The photo is drawn larger than the frame and
 * shifted by pan. The returned source square is what gets saved.
 */
export function cropGeometry(input: CropInput): CropGeometry {
  const imageWidth = positive(input.imageWidth);
  const imageHeight = positive(input.imageHeight);
  const frameSize = positive(input.frameSize);
  const zoom = clampZoom(input.zoom);
  const panX = clampPan(input.panX);
  const panY = clampPan(input.panY);
  const size = Math.min(imageWidth, imageHeight) / zoom;
  const displayScale = frameSize / size;
  const displayWidth = imageWidth * displayScale;
  const displayHeight = imageHeight * displayScale;
  const maxOffsetX = Math.max(0, (displayWidth - frameSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - frameSize) / 2);
  const offsetX = panX * maxOffsetX;
  const offsetY = panY * maxOffsetY;
  const left = (frameSize - displayWidth) / 2 + offsetX;
  const top = (frameSize - displayHeight) / 2 + offsetY;
  const x = clamp(-left / displayScale, 0, Math.max(0, imageWidth - size));
  const y = clamp(-top / displayScale, 0, Math.max(0, imageHeight - size));

  return {
    zoom,
    panX,
    panY,
    offsetX,
    offsetY,
    x,
    y,
    size,
    displayWidth,
    displayHeight,
    left,
    top,
  };
}

/** Apply a drag, in frame pixels, and keep the photo covering the square. */
export function panAfterDrag(input: CropInput & { deltaX: number; deltaY: number }): { panX: number; panY: number } {
  const frameSize = positive(input.frameSize);
  const current = cropGeometry({ ...input, frameSize });
  const maxOffsetX = Math.max(0, (current.displayWidth - frameSize) / 2);
  const maxOffsetY = Math.max(0, (current.displayHeight - frameSize) / 2);
  const deltaX = Number.isFinite(input.deltaX) ? input.deltaX : 0;
  const deltaY = Number.isFinite(input.deltaY) ? input.deltaY : 0;
  return {
    panX: maxOffsetX === 0 ? 0 : clampPan((current.offsetX + deltaX) / maxOffsetX),
    panY: maxOffsetY === 0 ? 0 : clampPan((current.offsetY + deltaY) / maxOffsetY),
  };
}
