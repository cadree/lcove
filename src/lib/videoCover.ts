/**
 * Video covers. A cover is a JPEG: an image the person uploads, a frame they
 * pick by scrubbing, or (if they do neither) a frame near one second in.
 */

/** Where the automatic cover comes from: 1s in, or the middle of a shorter clip. */
export function coverSeekTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (duration <= 2) return Math.max(0, duration / 2);
  return 1;
}

/** Scales a frame so its long side is at most `maxSide`, keeping the shape. */
export function coverSize(width: number, height: number, maxSide = 1080): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Frame at the video's current time, as a JPEG file. Null if the frame can't be read. */
export async function captureFrame(video: HTMLVideoElement, name = "cover.jpg"): Promise<File | null> {
  const size = coverSize(video.videoWidth, video.videoHeight);
  if (!size.width) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  try {
    context.drawImage(video, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ? new File([blob], name, { type: "image/jpeg" }) : null;
  } catch {
    // A cross-origin video without CORS taints the canvas.
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function once(target: EventTarget, event: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { target.removeEventListener(event, done); resolve(false); }, timeoutMs);
    function done() { window.clearTimeout(timer); target.removeEventListener(event, done); resolve(true); }
    target.addEventListener(event, done);
  });
}

/**
 * Reads a frame near 1s from a local file or a CORS-enabled URL, off screen.
 * Gives up after `timeoutMs` so posting never waits long on it.
 */
export async function autoCover(source: Blob | string, timeoutMs = 6000): Promise<File | null> {
  if (typeof document === "undefined") return null;
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (typeof source === "string") video.crossOrigin = "anonymous";
  try {
    video.src = url;
    if (!(await once(video, "loadedmetadata", timeoutMs))) return null;
    const ready = once(video, "seeked", timeoutMs);
    video.currentTime = coverSeekTime(video.duration);
    if (!(await ready) && video.readyState < 2) return null;
    return await captureFrame(video);
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
