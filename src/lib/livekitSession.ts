export const LIVE_VIDEO_NOT_CONFIGURED = "Live video not configured";

export const RECORDER_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
] as const;

export interface LiveKitReadySession {
  configured: true;
  url: string;
  token: string;
  room: string;
  canPublish: boolean;
}

export interface LiveKitMissingSession {
  configured: false;
  error: typeof LIVE_VIDEO_NOT_CONFIGURED;
}

export type LiveKitSession = LiveKitReadySession | LiveKitMissingSession;

export function pickRecorderMimeType(isSupported: (type: string) => boolean): string | null {
  return RECORDER_MIME_TYPES.find((type) => isSupported(type)) ?? null;
}

export function replayContentType(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm";
}

export function replayFileExtension(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

/** Refresh this long before the LiveKit JWT expires. */
export const TOKEN_REFRESH_LEAD_MS = 5 * 60 * 1000;

/** A token that is already inside the lead window waits this long before another join. */
export const TOKEN_REFRESH_MIN_MS = 60 * 1000;

export function jwtExpiryMs(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === "number" && Number.isFinite(json.exp) ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Milliseconds until the client should ask for a new LiveKit token. Null when the token has no exp. */
export function tokenRefreshDelayMs(
  token: string,
  now = Date.now(),
  leadMs = TOKEN_REFRESH_LEAD_MS,
): number | null {
  const expiry = jwtExpiryMs(token);
  if (expiry === null) return null;
  return Math.max(0, expiry - leadMs - now);
}

export function nextTokenRefreshDelay(token: string, now = Date.now()): number | null {
  const delay = tokenRefreshDelayMs(token, now);
  if (delay === null) return null;
  return delay === 0 ? TOKEN_REFRESH_MIN_MS : delay;
}

export function parseLiveKitTokenResponse(data: unknown): LiveKitSession | { error: string } {
  const body = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (body.configured === false || body.error === LIVE_VIDEO_NOT_CONFIGURED) {
    return { configured: false, error: LIVE_VIDEO_NOT_CONFIGURED };
  }
  if (typeof body.error === "string" && body.error) return { error: body.error };
  if (typeof body.token !== "string" || typeof body.url !== "string" || typeof body.room !== "string") {
    return { error: "Could not start live video" };
  }
  return {
    configured: true,
    url: body.url,
    token: body.token,
    room: body.room,
    canPublish: body.canPublish === true,
  };
}
