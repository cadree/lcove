import { compressOversizedVideo, StorageLimitError } from "@/lib/compressVideo";
import { CLIP_TOO_LONG_MESSAGE, decideBySize, fileKind } from "@/lib/storageLimit";

export { StorageLimitError };

/**
 * Return the bytes to upload. A file at or under the cap is the same object.
 * A larger video is compressed. A larger image or other file throws
 * StorageLimitError with a message meant to be shown as-is.
 */
export async function prepareStorageBody(
  body: Blob,
  onProgress?: (ratio: number) => void,
): Promise<{ body: Blob; contentType?: string }> {
  const name = body instanceof File ? body.name : "";
  const kind = fileKind(name, body.type || "");
  const decision = decideBySize(body.size, kind);

  if (decision.action === "keep") return { body };
  if (decision.action === "reject") throw new StorageLimitError(decision.message);

  try {
    const compressed = await compressOversizedVideo(body, onProgress);
    return { body: compressed, contentType: "video/mp4" };
  } catch (error) {
    if (error instanceof StorageLimitError) throw error;
    console.error("Video compression failed", error);
    throw new StorageLimitError(CLIP_TOO_LONG_MESSAGE);
  }
}
