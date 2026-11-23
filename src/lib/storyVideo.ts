import { zoomCrop } from "./storyCamera.ts";
import {
  STORY_FRAME_HEIGHT,
  STORY_FRAME_WIDTH,
  coverSourceRect,
  drawStoryOverlays,
  type StoryDrawContext,
  type StoryTextOverlay,
} from "./storyOverlay.ts";

/** Recorded stories are saved at 720x1280: sharp on a phone, quick to encode on one. */
export const STORY_VIDEO_WIDTH = 720;
export const STORY_VIDEO_HEIGHT = 1280;

export interface StoryVideoCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The 9:16 part of a recording the camera preview showed: object-fit cover,
 * then the screen zoom (when the camera could not zoom itself) from the centre.
 * Even pixel values keep H.264 encoders happy.
 */
export function storyVideoCrop(width: number, height: number, zoom = 1): StoryVideoCrop {
  const cover = zoomCrop(coverSourceRect(width, height, STORY_FRAME_WIDTH, STORY_FRAME_HEIGHT), zoom);
  const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
  const w = Math.min(even(cover.sw), even(width));
  const h = Math.min(even(cover.sh), even(height));
  const left = Math.max(0, Math.min(width - w, Math.round(cover.sx)));
  const top = Math.max(0, Math.min(height - h, Math.round(cover.sy)));
  return { left, top, width: w, height: h };
}

export interface BurnStoryVideoOptions {
  file: Blob;
  overlays: StoryTextOverlay[];
  /** Front camera: save it the way the preview showed it. */
  mirror?: boolean;
  /** Screen-only zoom used while recording (1 = none). */
  zoom?: number;
  onProgress?: (ratio: number) => void;
  waitForFonts?: () => Promise<void>;
}

/**
 * Cut a recording to the 9:16 story frame and burn the text in, using the
 * same drawStoryOverlays pass as photos. Output is H.264 mp4.
 */
export async function burnStoryVideo(options: BurnStoryVideoOptions): Promise<File> {
  if (options.waitForFonts) {
    try {
      await options.waitForFonts();
    } catch {
      /* system fonts still draw */
    }
  }
  const mb = await import("mediabunny");
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(options.file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("That clip has no video.");
    const [width, height] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
    const crop = storyVideoCrop(width, height, options.zoom ?? 1);
    const W = STORY_VIDEO_WIDTH;
    const H = STORY_VIDEO_HEIGHT;
    const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error("This phone cannot draw on video.");
    const overlays = options.overlays.filter((item) => item.text.trim());
    const ratio = W / STORY_FRAME_WIDTH;

    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      video: {
        codec: "avc",
        crop,
        flip: options.mirror === true,
        width: W,
        height: H,
        fit: "cover",
        frameRate: 30,
        quality: mb.QUALITY_HIGH,
        forceTranscode: true,
        allowTransformationMetadata: false,
        process: overlays.length
          ? (sample) => {
              ctx.clearRect(0, 0, W, H);
              sample.draw(ctx, 0, 0, W, H);
              ctx.save();
              ctx.scale(ratio, ratio);
              drawStoryOverlays(ctx as unknown as StoryDrawContext, overlays, STORY_FRAME_WIDTH, STORY_FRAME_HEIGHT);
              ctx.restore();
              return canvas;
            }
          : undefined,
        processedWidth: W,
        processedHeight: H,
      },
      audio: { codec: "aac", bitrate: 128_000 },
    });
    const keptVideo = conversion.utilizedTracks.some((item) => item.isVideoTrack());
    if (!conversion.isValid || !keptVideo) {
      throw new Error("This phone cannot save text on video yet.");
    }
    if (options.onProgress) conversion.onProgress = (value) => options.onProgress?.(value);
    await conversion.execute();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) throw new Error("Could not save that video.");
    return new File([buffer], "story.mp4", { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
