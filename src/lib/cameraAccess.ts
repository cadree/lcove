import { LIVE_REQUEST_TIMEOUT_MS } from "./withDeadline.ts";

export const CAMERA_TIMEOUT_MS = LIVE_REQUEST_TIMEOUT_MS;

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

export type CameraFailure =
  | "denied"
  | "in-use"
  | "no-device"
  | "insecure"
  | "unsupported"
  | "timeout"
  | "failed";

export interface CameraTrack {
  stop(): void;
}

export interface CameraStream {
  getTracks(): CameraTrack[];
}

const COPY: Record<CameraFailure, { title: string; message: string }> = {
  denied: {
    title: "Camera access denied",
    message: "Camera access was denied. Allow the camera and microphone in the browser, then try again.",
  },
  "in-use": {
    title: "Camera is busy",
    message: "The camera is in use by a phone call or another app. End the call, then try again.",
  },
  "no-device": {
    title: "No camera found",
    message: "No camera or microphone was found.",
  },
  insecure: {
    title: "Camera needs a secure page",
    message: "The camera needs a secure connection. Open this page over https, then try again.",
  },
  unsupported: {
    title: "Camera not supported",
    message: "This browser cannot use the camera.",
  },
  timeout: {
    title: "Camera did not start",
    message: "The camera did not start. It may be busy with a phone call. Try again, or close this screen.",
  },
  failed: {
    title: "Camera error",
    message: "The camera could not start. Try again.",
  },
};

export function cameraFailureCopy(failure: CameraFailure): { title: string; message: string } {
  return COPY[failure];
}

export function classifyCameraError(error: unknown): CameraFailure {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError") return "timeout";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no-device";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "in-use";
  if (name === "SecurityError") return "insecure";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "failed";
}

export function stopStreamTracks(stream: CameraStream | null | undefined) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* already ended */
    }
  }
}

export type CameraResult<T extends CameraStream> =
  | { ok: true; stream: T }
  | { ok: false; failure: CameraFailure; title: string; message: string };

function fail(failure: CameraFailure): CameraResult<never> {
  const copy = cameraFailureCopy(failure);
  return { ok: false, failure, title: copy.title, message: copy.message };
}

export async function requestCamera<T extends CameraStream>(options: {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<T>;
  secure: boolean;
  supported: boolean;
  timeoutMs?: number;
  stillWanted?: () => boolean;
}): Promise<CameraResult<T>> {
  if (!options.secure) return fail("insecure");
  if (!options.supported) return fail("unsupported");

  const timeoutMs = options.timeoutMs ?? CAMERA_TIMEOUT_MS;
  let settled = false;
  const pending = options.getUserMedia(CAMERA_CONSTRAINTS).then(
    (stream) => {
      if (settled || options.stillWanted?.() === false) {
        stopStreamTracks(stream);
        return null;
      }
      return stream;
    },
    (error: unknown) => {
      throw error;
    },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Camera request timed out");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });

  try {
    const stream = await Promise.race([pending, timeout]);
    settled = true;
    if (!stream || options.stillWanted?.() === false) {
      stopStreamTracks(stream);
      return fail("timeout");
    }
    return { ok: true, stream };
  } catch (error) {
    settled = true;
    const failure = error instanceof Error && error.name === "TimeoutError" ? "timeout" : classifyCameraError(error);
    return fail(failure);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
