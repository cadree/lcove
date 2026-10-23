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
