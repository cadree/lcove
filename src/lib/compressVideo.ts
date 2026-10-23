import {
  CLIP_TOO_LONG_MESSAGE,
  STORAGE_LIMIT_BYTES,
  planVideoEncode,
  type VideoEncodePlan,
} from "@/lib/storageLimit";

export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageLimitError";
  }
}

type Encoder = typeof import("mediabunny");
type EncodePlan = Extract<VideoEncodePlan, { ok: true }>;

/**
 * Re-encode an oversized video so it lands under the storage cap.
 * Uses the browser's built-in encoder (loaded on demand) so it works in
 * the web app and in the Capacitor iOS web view. The caller has already
 * decided the file is over the cap.
 */
export async function compressOversizedVideo(
  file: Blob,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  onProgress?.(0);
  const encoder = await import("mediabunny");
  const plan = await readEncodePlan(file, encoder);
  if (plan.ok === false) throw new StorageLimitError(plan.message);

  const bitratePass = await encodePass(
    file,
    plan,
    new encoder.Quality({ bitrate: plan.videoBitrate, bitrateMode: "constant" }),
    encoder,
    (ratio) => onProgress?.(ratio),
  );
  if (bitratePass) return bitratePass;

  // Chrome's software H.264 encoder can ignore the requested bitrate and
  // come back still over the cap. A second pass asks for a coarser picture.
  const quantizerPass = await encodePass(
    file,
    plan,
    new encoder.Quality({ quantizer: 38 }),
    encoder,
    (ratio) => onProgress?.(ratio),
  );
  if (quantizerPass) return quantizerPass;

  throw new StorageLimitError(CLIP_TOO_LONG_MESSAGE);
}

async function readEncodePlan(file: Blob, encoder: Encoder) {
  const input = new encoder.Input({
    formats: encoder.ALL_FORMATS,
    source: new encoder.BlobSource(file),
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { ok: false as const, message: CLIP_TOO_LONG_MESSAGE };
    const durationSec = await input.computeDuration();
    const [width, height] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
    ]);
    let fps = 30;
    try {
      const stats = await track.computePacketStats(48);
      if (stats.averagePacketRate > 1 && stats.averagePacketRate < 240) {
        fps = stats.averagePacketRate;
      }
    } catch {
      // Dimensions and duration are enough. 30fps is the fallback.
    }
    return planVideoEncode({ width, height, durationSec, fps });
  } finally {
    input.dispose();
  }
}

/** Returns the file when it fits, otherwise nothing so the caller can retry. */
async function encodePass(
  file: Blob,
  plan: EncodePlan,
  videoQuality: InstanceType<Encoder["Quality"]>,
  encoder: Encoder,
  onProgress?: (ratio: number) => void,
): Promise<File | null> {
  const input = new encoder.Input({
    formats: encoder.ALL_FORMATS,
    source: new encoder.BlobSource(file),
  });
  try {
    const target = new encoder.BufferTarget();
    const output = new encoder.Output({
      format: new encoder.Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const conversion = await encoder.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      copy: false,
      video: {
        codec: "avc",
        ...(plan.resize
          ? { width: plan.width, height: plan.height, fit: "contain" as const }
          : {}),
        quality: videoQuality,
      },
      audio: {
        quality: new encoder.Quality({ bitrate: plan.audioBitrate, bitrateMode: "constant" }),
      },
    });
    const keptVideo = conversion.utilizedTracks.some((item) => item.isVideoTrack());
    if (!conversion.isValid || !keptVideo) {
      console.error(
        "Video compression cannot run",
        conversion.discardedTracks.map((item) => item.reason),
      );
      return null;
    }
    conversion.onProgress = (progress) => {
      if (Number.isFinite(progress)) onProgress?.(Math.max(0, Math.min(1, progress)));
    };
    await conversion.execute();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0 || buffer.byteLength > STORAGE_LIMIT_BYTES) return null;
    const stem = (file instanceof File ? file.name : "").replace(/\.[^.]+$/, "").trim();
    return new File([buffer], `${stem || "video"}.mp4`, { type: "video/mp4" });
  } catch (error) {
    console.error("Video compression pass failed", error);
    return null;
  } finally {
    input.dispose();
  }
}
