const PUBLIC_MEDIA = "/storage/v1/object/public/media/";

/**
 * Seconds the free storage CDN may keep serving a public replay after delete.
 * That CDN has no purge API. supabase-js sends this value as max-age.
 */
export const REPLAY_CACHE_CONTROL = "60";

/** A new id for every upload so a replay never reuses a cached URL. */
export function replayUploadId(now = Date.now(), salt = Math.random().toString(36).slice(2, 10)): string {
  return `${now}-${salt}`;
}

/** Object path for one replay upload. The first folder is the host's user id. */
export function replayObjectPath(userId: string, streamId: string, extension: string, unique = replayUploadId()): string {
  const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webm";
  return `${userId}/replays/${streamId}-${unique}.${ext}`;
}

/** Path inside the media bucket for a public replay URL. */
export function mediaObjectPath(publicUrl: string): string | null {
  const index = publicUrl.indexOf(PUBLIC_MEDIA);
  if (index < 0) return null;
  const path = publicUrl.slice(index + PUBLIC_MEDIA.length).split("?")[0].split("#")[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
