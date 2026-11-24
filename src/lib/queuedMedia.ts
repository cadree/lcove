import { useSyncExternalStore } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { enqueueUpload, mediaPath } from "@/lib/backgroundUploads";
import { pendingUploads, type PendingItem, type PendingKind } from "@/lib/pendingUploads";
import { errorText } from "@/lib/uploadQueue";

export function usePendingUploads(): PendingItem[] {
  return useSyncExternalStore(pendingUploads.subscribe, pendingUploads.getSnapshot, pendingUploads.getSnapshot);
}

interface QueueMedia {
  queryClient: QueryClient;
  userId: string;
  kind: PendingKind;
  label: string;
  files: File[];
  mediaType: "photo" | "video";
  content?: string | null;
  bucket?: string;
  /** Write the row once every file is stored. */
  insert(urls: string[]): Promise<void>;
  invalidate: QueryKey[];
  successMessage: string;
  /** Show a placeholder in the feed/story tray while it uploads. Off for drafts. */
  placeholder?: boolean;
}

/**
 * Hand media to the background queue and return at once. A placeholder shows
 * the local preview in the feed or story tray until the row exists.
 */
export function queueMedia(input: QueueMedia): string {
  const preview = input.files[0] ? URL.createObjectURL(input.files[0]) : null;
  const pendingId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const bucket = input.bucket ?? "media";
  const files = input.files.map((file, index) => ({ bucket, path: mediaPath(input.userId, file, index), file }));
  const cleanup = () => {
    pendingUploads.remove(pendingId);
    if (preview) URL.revokeObjectURL(preview);
  };
  const jobId = enqueueUpload({
    label: input.label,
    files,
    finish: async (urls) => {
      await input.insert(urls);
      await Promise.all(input.invalidate.map((queryKey) => input.queryClient.invalidateQueries({ queryKey })));
    },
    onDone: () => {
      cleanup();
      toast.success(input.successMessage);
    },
    onFail: (error) => {
      pendingUploads.update(pendingId, { failed: true });
      toast.error(`${input.label} didn't upload`, { description: errorText(error) });
    },
    onAbandon: cleanup,
  });
  if (input.placeholder === false) return jobId;
  pendingUploads.add({
    id: pendingId,
    jobId,
    kind: input.kind,
    userId: input.userId,
    content: input.content ?? null,
    mediaUrl: preview,
    mediaType: input.mediaType,
    createdAt: new Date().toISOString(),
    failed: false,
  });
  return jobId;
}
