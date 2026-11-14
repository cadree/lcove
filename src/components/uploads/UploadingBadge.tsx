import { Loader2, RotateCw } from "lucide-react";
import { uploadQueue, useUploadJobs } from "@/lib/backgroundUploads";

/** Sits on a placeholder post while its media uploads. */
export function UploadingBadge({ jobId }: { jobId: string }) {
  const job = useUploadJobs().find((item) => item.id === jobId);
  if (!job || job.status === "done") return null;
  const failed = job.status === "failed";
  return (
    <span className="absolute inset-x-0 bottom-0 z-[2] flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-[12px] text-white">
      <span className="flex min-w-0 items-center gap-2">
        {failed ? null : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span className="truncate">{failed ? "Upload failed" : job.status === "saving" ? "Finishing" : `Uploading ${Math.round(job.progress * 100)}%`}</span>
      </span>
      {failed && job.retryable && (
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => { event.stopPropagation(); uploadQueue.retry(job.id); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); uploadQueue.retry(job.id); } }}
          className="flex min-h-9 items-center gap-1 rounded-full bg-white/15 px-3 font-medium"
        >
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/15">
        <span className="block h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </span>
    </span>
  );
}
