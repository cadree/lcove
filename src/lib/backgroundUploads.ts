import { useSyncExternalStore } from "react";
import { uploadWithProgress } from "@/integrations/supabase/client";
import { createUploadQueue, type UploadJob, type UploadSpec } from "@/lib/uploadQueue";

export const uploadQueue = createUploadQueue({
  transport: { send: (file, onProgress) => uploadWithProgress(file.bucket, file.path, file.file, onProgress) },
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (!uploadQueue.busy()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

export function enqueueUpload(spec: UploadSpec): string {
  return uploadQueue.enqueue(spec);
}

export function useUploadJobs(): UploadJob[] {
  return useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot, uploadQueue.getSnapshot);
}

/** Storage path for a new media file: {user}/{time}-{rand}.{ext}. */
export function mediaPath(userId: string, file: Blob, index = 0): string {
  const name = file instanceof File ? file.name : "";
  const ext = (name.includes(".") ? name.split(".").pop() : "")?.toLowerCase().replace(/[^a-z0-9]/g, "")
    || (file.type.split("/")[1] || "bin").replace(/[^a-z0-9]/g, "");
  return `${userId}/${Date.now()}${index ? `_${index}` : ""}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
