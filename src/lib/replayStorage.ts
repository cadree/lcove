const PUBLIC_MEDIA = "/storage/v1/object/public/media/";

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
