import { requestCamera, stopStreamTracks, type CameraResult, type CameraStream } from "./cameraAccess.ts";
import { coverSourceRect, storyFrameSize, STORY_FRAME_WIDTH } from "./storyOverlay.ts";

export type StoryFacing = "user" | "environment";

export function storyCameraConstraints(facing: StoryFacing): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1080 },
        height: { ideal: 1920 },
        aspectRatio: { ideal: 9 / 16 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: facing } }, audio: false },
    { video: true, audio: false },
  ];
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
  const crop = coverSourceRect(srcW, srcH, viewW, viewH);
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
