/**
 * Supabase free plan rejects any object over 50 MB. The media, avatars,
 * board-uploads, and contact-media buckets do not set a lower limit.
 * A file at or under the cap is uploaded untouched.
 */
export const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;

/**
 * Encoder target. Constant-bitrate output still runs a little over the
 * requested rate, so this sits under the hard cap.
 */
export const STORAGE_TARGET_BYTES = 45 * 1024 * 1024;

export const AUDIO_BITRATE = 128_000;

/**
 * Below this, a 1080p picture is not worth sending. Ask the person to trim.
 */
export const MIN_VIDEO_BITRATE = 1_500_000;

/** Short side never drops below this when the source is at least this large. */
export const MIN_SHORT_SIDE = 1080;

/**
 * Bits per pixel per frame. Under this, the frame is scaled down (not below
 * 1080p) so the bitrate is spent on fewer pixels.
 */
export const MIN_BITS_PER_PIXEL = 0.07;

export const CLIP_TOO_LONG_MESSAGE =
  "This clip is too long to upload. Trim it and try again.";

export const IMAGE_TOO_LARGE_MESSAGE =
  "This image is too large to upload. It has to be under 50 MB.";

export const FILE_TOO_LARGE_MESSAGE =
  "This file is too large to upload. It has to be under 50 MB.";

export type MediaKind = "video" | "image" | "other";

export type SizeDecision =
  | { action: "keep" }
  | { action: "compress" }
  | { action: "reject"; message: string };

export type VideoEncodePlan =
  | {
      ok: true;
      width: number;
      height: number;
      videoBitrate: number;
      audioBitrate: number;
      resize: boolean;
    }
  | { ok: false; message: string };

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "mkv",
  "avi",
  "qt",
  "3gp",
  "mpeg",
  "mpg",
]);

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "avif",
  "bmp",
  "tif",
  "tiff",
]);

export function storageLimitMessage(kind: MediaKind): string {
  if (kind === "video") return CLIP_TOO_LONG_MESSAGE;
  if (kind === "image") return IMAGE_TOO_LARGE_MESSAGE;
  return FILE_TOO_LARGE_MESSAGE;
}

export function fileKind(name: string, mime: string): MediaKind {
  const type = mime.toLowerCase();
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return "other";
}

/** What to do with a file before it is sent to storage. */
export function decideBySize(size: number, kind: MediaKind): SizeDecision {
  if (!Number.isFinite(size) || size < 0) {
    return { action: "reject", message: FILE_TOO_LARGE_MESSAGE };
  }
  if (size <= STORAGE_LIMIT_BYTES) return { action: "keep" };
  if (kind === "video") return { action: "compress" };
  return { action: "reject", message: storageLimitMessage(kind) };
}

function evenFloor(value: number): number {
  const floored = Math.floor(value);
  const even = floored % 2 === 0 ? floored : floored - 1;
  return Math.max(2, even);
}

function evenCeil(value: number): number {
  return Math.max(2, Math.ceil(value / 2) * 2);
}

/**
 * Largest frame that the bitrate can feed, keeping the source frame when it
 * already fits. Never enlarges the frame. Never takes the short side below
 * 1080 when the source short side is at least 1080.
 */
export function fitResolution(
  srcWidth: number,
  srcHeight: number,
  videoBitrate: number,
  fps: number,
): { width: number; height: number } {
  const frameRate = fps > 0 ? fps : 30;
  const pixels = srcWidth * srcHeight;
  const bitsPerPixel = videoBitrate / frameRate / pixels;
  let scale = 1;
  if (bitsPerPixel < MIN_BITS_PER_PIXEL && pixels > 0) {
    const targetPixels = videoBitrate / frameRate / MIN_BITS_PER_PIXEL;
    scale = Math.sqrt(targetPixels / pixels);
  }

  const shortSide = Math.min(srcWidth, srcHeight);
  const floorShort = Math.min(MIN_SHORT_SIDE, shortSide);
  const minScale = shortSide > 0 ? floorShort / shortSide : 1;
  if (scale < minScale) scale = minScale;
  if (scale > 1) scale = 1;

  return {
    width: Math.min(evenCeil(srcWidth * scale), evenFloor(srcWidth)),
    height: Math.min(evenCeil(srcHeight * scale), evenFloor(srcHeight)),
  };
}

export function planVideoEncode(input: {
  width: number;
  height: number;
  durationSec: number;
  fps?: number;
}): VideoEncodePlan {
  const { width, height, durationSec } = input;
  const fps = input.fps && input.fps > 0 ? input.fps : 30;
  if (!(width > 0) || !(height > 0) || !(durationSec > 0) || !Number.isFinite(durationSec)) {
    return { ok: false, message: CLIP_TOO_LONG_MESSAGE };
  }

  const videoBitrate = (STORAGE_TARGET_BYTES * 8) / durationSec - AUDIO_BITRATE;
  if (videoBitrate < MIN_VIDEO_BITRATE) {
    return { ok: false, message: CLIP_TOO_LONG_MESSAGE };
  }

  const fitted = fitResolution(width, height, videoBitrate, fps);
  const source = fitResolution(width, height, Number.POSITIVE_INFINITY, fps);
  return {
    ok: true,
    width: fitted.width,
    height: fitted.height,
    videoBitrate: Math.round(videoBitrate),
    audioBitrate: AUDIO_BITRATE,
    resize: fitted.width !== source.width || fitted.height !== source.height,
  };
}

export function isStorageSizeMessage(message: string, status?: number | string): boolean {
  if (Number(status) === 413) return true;
  const text = message.toLowerCase();
  return (
    text.includes("maximum allowed size") ||
    text.includes("payload too large") ||
    text.includes("entity too large") ||
    text.includes("exceeded the maximum")
  );
}

export function isStorageSizeRejection(error: {
  message?: string;
  status?: number;
  statusCode?: string | number;
}): boolean {
  return isStorageSizeMessage(error.message ?? "", error.status ?? error.statusCode);
}
