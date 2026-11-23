import { requestCamera, stopStreamTracks, type CameraResult, type CameraStream } from "./cameraAccess.ts";
import { coverSourceRect, storyFrameSize, STORY_FRAME_WIDTH } from "./storyOverlay.ts";

export type StoryFacing = "user" | "environment";

/**
 * Ask for resolution by width only. A height or aspect-ratio constraint makes
 * WebKit crop the sensor to fit, which is what made the preview look zoomed
 * in. Width alone keeps the camera's own frame shape (and field of view); the
 * 9:16 story frame is cut from it on screen and in the saved file.
 */
export function storyCameraConstraints(facing: StoryFacing): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1920 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: facing } }, audio: false },
    { video: true, audio: false },
  ];
}

export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

/** Native camera zoom (WebKit on iOS 17+, Chrome PTZ). Null when the track has none. */
export function trackZoomRange(
  track: { getCapabilities?: () => unknown } | null | undefined,
): ZoomRange | null {
  if (!track || typeof track.getCapabilities !== "function") return null;
  try {
    const zoom = (track.getCapabilities() as { zoom?: { min?: number; max?: number; step?: number } }).zoom;
    if (!zoom || typeof zoom.min !== "number" || typeof zoom.max !== "number") return null;
    if (!(zoom.max > zoom.min)) return null;
    return { min: zoom.min, max: zoom.max, step: typeof zoom.step === "number" && zoom.step > 0 ? zoom.step : 0 };
  } catch {
    return null;
  }
}

export function trackZoom(track: { getSettings?: () => unknown } | null | undefined): number | null {
  try {
    const zoom = (track?.getSettings?.() as { zoom?: number } | undefined)?.zoom;
    return typeof zoom === "number" && Number.isFinite(zoom) ? zoom : null;
  } catch {
    return null;
  }
}

export async function setTrackZoom(
  track: { applyConstraints: (constraints: MediaTrackConstraints) => Promise<void> } | null | undefined,
  zoom: number,
): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ zoom }] as unknown as MediaTrackConstraintSet[] });
    return true;
  } catch {
    return false;
  }
}

/** Screen zoom when the camera cannot zoom itself: 1x to 5x, cropped from the centre. */
export const FALLBACK_ZOOM: ZoomRange = { min: 1, max: 5, step: 0 };

export function clampZoom(value: number, range: ZoomRange): number {
  if (!Number.isFinite(value)) return range.min;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  if (!range.step) return clamped;
  return Math.min(range.max, Math.max(range.min, Math.round(clamped / range.step) * range.step));
}

/** Two-finger pinch: zoom follows the ratio of the finger gap, like the iPhone camera. */
export function pinchZoom(startZoom: number, startGap: number, gap: number, range: ZoomRange): number {
  if (!(startGap > 0) || !(gap > 0)) return clampZoom(startZoom, range);
  return clampZoom(startZoom * (gap / startGap), range);
}

/** 1x on open. Virtual iPhone cameras can expose 0.5 (ultra wide); never start on tele. */
export function defaultZoom(range: ZoomRange | null, current: number | null): number | null {
  if (!range) return null;
  if (range.min <= 1 && range.max >= 1) return 1;
  return current ?? range.min;
}

export function formatZoom(zoom: number): string {
  const rounded = Math.round(zoom * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}x`;
}

export const STORY_MAX_RECORD_MS = 15_000;
export const STORY_HOLD_TO_RECORD_MS = 250;

/**
 * Where one shutter press is. "pressing" until the hold threshold, "starting" while the
 * mic and recorder spin up, "recording" once the recorder runs, "unsupported" when this
 * device cannot record (the press then ends without a photo).
 */
export type ShutterPhase = "pressing" | "starting" | "recording" | "unsupported";

/**
 * What letting go of the shutter does. iOS can end a touch with a cancel instead of a
 * lift when one of its own gesture recognizers claims it, so a cancel before the hold
 * threshold still counts as a tap. Taking a photo never depends on the recorder.
 */
export function shutterRelease(phase: ShutterPhase, cancelled: boolean): "photo" | "stop-recording" | "none" {
  if (phase === "recording") return "stop-recording";
  if (phase === "pressing") return "photo";
  if (phase === "starting") return cancelled ? "none" : "photo";
  return "none";
}

const STORY_RECORDER_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

/** Stories prefer mp4 (what iOS records) so every player and share path can show it. */
export function pickStoryRecorderType(isSupported: (type: string) => boolean): string | null {
  for (const type of STORY_RECORDER_TYPES) {
    try {
      if (isSupported(type)) return type;
    } catch {
      /* some engines throw on unknown codecs */
    }
  }
  return null;
}

export function recordingExtension(mimeType: string): "mp4" | "webm" {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

export function oppositeFacing(facing: StoryFacing): StoryFacing {
  return facing === "user" ? "environment" : "user";
}

export function videoTrackFrom(stream: CameraStream | MediaStream | null | undefined): MediaStreamTrack | null {
  if (!stream || typeof stream.getTracks !== "function") return null;
  const tracks = stream.getTracks();
  const named = "getVideoTracks" in stream && typeof stream.getVideoTracks === "function"
    ? stream.getVideoTracks()
    : [];
  return (named[0] ?? tracks.find((track) => "kind" in track && track.kind === "video") ?? tracks[0] ?? null) as MediaStreamTrack | null;
}

export function trackHasTorch(track: MediaStreamTrack | { getCapabilities?: () => { torch?: boolean } } | null | undefined): boolean {
  if (!track || typeof track.getCapabilities !== "function") return false;
  try {
    const capabilities = track.getCapabilities() as { torch?: boolean };
    return capabilities.torch === true;
  } catch {
    return false;
  }
}

export async function setTrackTorch(
  track: MediaStreamTrack | { applyConstraints: (constraints: MediaTrackConstraints) => Promise<void> } | null | undefined,
  on: boolean,
): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] as unknown as MediaTrackConstraintSet[] });
    return true;
  } catch {
    try {
      await track.applyConstraints({ torch: on } as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }
}

export function facingFromTrack(
  track: { getSettings?: () => { facingMode?: string } } | null | undefined,
  fallback: StoryFacing,
): StoryFacing {
  try {
    const mode = track?.getSettings?.().facingMode;
    if (mode === "user" || mode === "environment") return mode;
  } catch {
    /* some browsers throw if the track has ended */
  }
  return fallback;
}

export async function startStoryCamera(options: {
  facing: StoryFacing;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  secure?: boolean;
  supported?: boolean;
  stillWanted?: () => boolean;
  timeoutMs?: number;
}): Promise<CameraResult<MediaStream>> {
  const getUserMedia = options.getUserMedia
    ?? ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
  const secure = options.secure ?? (typeof window !== "undefined" && window.isSecureContext);
  const supported = options.supported
    ?? (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function");
  return requestCamera({
    getUserMedia,
    secure,
    supported,
    stillWanted: options.stillWanted,
    timeoutMs: options.timeoutMs,
    constraints: storyCameraConstraints(options.facing),
  });
}

export function stopStoryCamera(stream: CameraStream | MediaStream | null | undefined) {
  stopStreamTracks(stream);
}

export interface CaptureFrameSource {
  videoWidth: number;
  videoHeight: number;
}

export interface CaptureView {
  width: number;
  height: number;
}

/** Crop the camera frame to the visible preview (object-fit: cover) and optionally mirror it. */
export function captureCoverFrame(
  source: CaptureFrameSource,
  view: CaptureView,
  options: {
    mirror?: boolean;
    /** Screen-only zoom (1 = none). Crops the centre so the photo matches the preview. */
    zoom?: number;
    minWidth?: number;
    draw?: (
      ctx: CanvasRenderingContext2D,
      crop: { sx: number; sy: number; sw: number; sh: number },
      dest: { width: number; height: number },
      mirror: boolean,
    ) => void;
    createCanvas?: (width: number, height: number) => { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  } = {},
): { canvas: HTMLCanvasElement; width: number; height: number; crop: { sx: number; sy: number; sw: number; sh: number }; mirror: boolean } {
  const srcW = source.videoWidth;
  const srcH = source.videoHeight;
  const viewW = view.width || srcW;
  const viewH = view.height || srcH;
  const crop = zoomCrop(coverSourceRect(srcW, srcH, viewW, viewH), options.zoom ?? 1);
  const frame = storyFrameSize(Math.max(options.minWidth ?? STORY_FRAME_WIDTH, Math.round(crop.sw)));
  const create = options.createCanvas ?? ((width: number, height: number) => {
    if (typeof document === "undefined") throw new Error("No canvas is available to take a photo.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot take a photo.");
    return { canvas, ctx };
  });
  const { canvas, ctx } = create(frame.width, frame.height);
  const mirror = options.mirror === true;
  if (options.draw) {
    options.draw(ctx, crop, frame, mirror);
  } else {
    if (mirror) {
      ctx.translate(frame.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      source as unknown as CanvasImageSource,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      frame.width,
      frame.height,
    );
  }
  return { canvas, width: frame.width, height: frame.height, crop, mirror };
}

/** Shrink a crop around its centre for a screen zoom factor. */
export function zoomCrop(
  crop: { sx: number; sy: number; sw: number; sh: number },
  zoom: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!(zoom > 1)) return crop;
  const sw = crop.sw / zoom;
  const sh = crop.sh / zoom;
  return { sx: crop.sx + (crop.sw - sw) / 2, sy: crop.sy + (crop.sh - sh) / 2, sw, sh };
}

export async function canvasToJpegFile(
  canvas: { toBlob?: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void; toDataURL?: (type?: string, quality?: number) => string },
  quality = 0.92,
  name = "story.jpg",
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob(resolve, "image/jpeg", quality);
      return;
    }
    resolve(null);
  });
  if (blob && blob.size > 0) return new File([blob], name, { type: "image/jpeg" });
  if (typeof canvas.toDataURL === "function") {
    const data = canvas.toDataURL("image/jpeg", quality);
    const match = data.match(/^data:image\/jpeg;base64,(.+)$/);
    if (match) {
      const binary = atob(match[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], name, { type: "image/jpeg" });
    }
  }
  throw new Error("Could not save that photo.");
}
