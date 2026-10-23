/**
 * Phone and desktop choices for the live room.
 *
 * LiveKit Cloud's free Build plan includes 60 transcode minutes a month for
 * recording and RTMP, shared with stream import, and then new requests fail
 * instead of billing. Those files also have to be written to a storage bucket
 * this project does not have. YouTube and Twitch restream uses that same
 * meter (Ship is $50 a month, then $0.02 per video minute). None of that is
 * turned on. The host records on the device and uploads the file when it fits
 * the 50 MB storage cap.
 */

export const REPLAY_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

export const PHONE_CAPTURE = { width: 640, height: 360, frameRate: 24 } as const;
export const DESKTOP_CAPTURE = { width: 1280, height: 720, frameRate: 30 } as const;

export type CaptureDevice = "phone" | "desktop";

export interface CaptureSignals {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

export function captureDevice(input: CaptureSignals): CaptureDevice {
  const ua = input.userAgent || "";
  const ipadOs = (input.platform || "") === "MacIntel" && (input.maxTouchPoints ?? 0) > 1;
  if (ipadOs || /iPhone|iPad|iPod|Android/i.test(ua)) return "phone";
  return "desktop";
}

export function isIosCapture(input: CaptureSignals): boolean {
  const ua = input.userAgent || "";
  const ipadOs = (input.platform || "") === "MacIntel" && (input.maxTouchPoints ?? 0) > 1;
  return ipadOs || /iPhone|iPad|iPod/i.test(ua);
}

export function cameraConstraintAttempts(device: CaptureDevice): MediaStreamConstraints[] {
  const size = device === "phone" ? PHONE_CAPTURE : DESKTOP_CAPTURE;
  return [
    {
      video: {
        facingMode: "user",
        width: { ideal: size.width, max: size.width },
        height: { ideal: size.height, max: size.height },
        frameRate: { ideal: size.frameRate, max: 30 },
      },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    },
    { video: { facingMode: "user" }, audio: true },
    { video: true, audio: true },
  ];
}

export interface PublishPlan {
  simulcast: boolean;
  videoCodec: "h264" | "vp8";
  maxBitrate: number;
  maxFramerate: number;
  degradationPreference: "maintain-framerate" | "balanced";
  /** Lower layers under the captured frame. One extra layer on a phone, two on a desktop. */
  layers: { width: number; height: number; maxBitrate: number; maxFramerate: number }[];
}

export function publishPlan(device: CaptureDevice): PublishPlan {
  if (device === "phone") {
    return {
      simulcast: true,
      videoCodec: "h264",
      maxBitrate: 600_000,
      maxFramerate: 24,
      degradationPreference: "maintain-framerate",
      layers: [{ width: 320, height: 180, maxBitrate: 150_000, maxFramerate: 15 }],
    };
  }
  return {
    simulcast: true,
    videoCodec: "vp8",
    maxBitrate: 1_700_000,
    maxFramerate: 30,
    degradationPreference: "balanced",
    layers: [
      { width: 320, height: 180, maxBitrate: 160_000, maxFramerate: 15 },
      { width: 640, height: 360, maxBitrate: 450_000, maxFramerate: 20 },
    ],
  };
}

export type AudioSessionKind = "play-and-record" | "playback";

export function setAudioSession(nav: object | null | undefined, kind: AudioSessionKind): boolean {
  if (!nav || !("audioSession" in nav)) return false;
  const session = (nav as { audioSession?: { type?: string } }).audioSession;
  if (!session) return false;
  session.type = kind;
  return true;
}

export function prepareVideoElement(video: HTMLVideoElement, mode: "preview" | "remote") {
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.autoplay = true;
  if (mode === "preview") video.muted = true;
}

/** Safari rejects a timeslice on video/mp4 and returns an empty file. */
export function recorderTimeslice(mimeType: string): number | undefined {
  if (mimeType.startsWith("video/mp4")) return undefined;
  return 1000;
}

export function tracksNeedRestart(tracks: { readyState: string }[]): boolean {
  return tracks.length === 0 || tracks.every((track) => track.readyState === "ended");
}

export type ReplayUploadPlan =
  | { action: "upload" }
  | { action: "keep-local"; message: string };

export function replayUploadPlan(size: number): ReplayUploadPlan {
  if (!Number.isFinite(size) || size <= 0) {
    return { action: "keep-local", message: "The stream was too short to save." };
  }
  if (size > REPLAY_UPLOAD_LIMIT_BYTES) {
    return {
      action: "keep-local",
      message:
        "This recording is over the 50 MB upload limit, so it was not added to Replays. Save it on this phone and post that file to YouTube or Twitch.",
    };
  }
  return { action: "upload" };
}

export type LiveLink = "live" | "reconnecting" | "offline";

export function liveLinkAfter(
  event: "reconnecting" | "reconnected" | "disconnected",
  ending: boolean,
): LiveLink | "ended" {
  if (ending) return "ended";
  if (event === "reconnecting") return "reconnecting";
  if (event === "reconnected") return "live";
  return "offline";
}

export async function saveRecordingFile(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type || "video/mp4" });
  const nav = typeof navigator === "undefined"
    ? undefined
    : navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav && typeof nav.share === "function") {
    const allowed = typeof nav.canShare !== "function" || nav.canShare({ files: [file] });
    if (allowed) {
      try {
        await nav.share({ files: [file], title: "Ether replay" });
        return "shared";
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return "shared";
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
