import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, CloudUpload, RotateCw, X } from "lucide-react";
import { uploadQueue, useUploadJobs } from "@/lib/backgroundUploads";
import { pillText, type UploadJob } from "@/lib/uploadQueue";
import { cn } from "@/lib/utils";

function Ring({ progress, failed, done }: { progress: number; failed: boolean; done: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={2.5} />
        {!failed && (
          <circle cx="12" cy="12" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - (done ? 1 : progress))} className="transition-[stroke-dashoffset] duration-300" />
        )}
      </svg>
      {done ? <Check className="h-3 w-3 text-primary" /> : failed ? <X className="h-3 w-3 text-destructive" /> : <CloudUpload className="h-3 w-3 opacity-80" />}
    </span>
  );
}

function Row({ job }: { job: UploadJob }) {
  const failed = job.status === "failed";
  const done = job.status === "done";
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Ring progress={job.progress} failed={failed} done={done} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-foreground">{job.label}</p>
        <p className={cn("truncate text-[11px]", failed ? "text-destructive" : "text-muted-foreground")}>
          {failed ? job.error : done ? "Posted" : job.status === "saving" ? "Finishing" : job.status === "queued" ? "Waiting" : `${Math.round(job.progress * 100)}%`}
        </p>
      </div>
      {failed && job.retryable && (
        <button type="button" onClick={() => uploadQueue.retry(job.id)} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-[12px] font-medium text-primary hover:bg-primary/10">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
      {(failed || done) && (
        <button type="button" aria-label={`Dismiss ${job.label}`} onClick={() => uploadQueue.dismiss(job.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

/** Floating status for background uploads. Mounted once in App, so it stays across pages. */
export function UploadQueuePill() {
  const jobs = useUploadJobs();
  const [open, setOpen] = useState(false);
  if (!jobs.length) return null;
  const failed = jobs.some((job) => job.status === "failed");
  const active = jobs.filter((job) => job.status !== "done" && job.status !== "failed");
  const done = !active.length && !failed;
  const progress = active.length ? active.reduce((sum, job) => sum + job.progress, 0) / active.length : 1;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
    >
      <AnimatePresence>
        <motion.div
          key="upload-pill"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-[22px] border border-border/70 bg-background/85 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left"
            aria-expanded={open}
          >
            <Ring progress={progress} failed={failed && !active.length} done={done} />
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", failed && !active.length ? "text-destructive" : "text-foreground")}>
              {pillText(jobs)}
            </span>
            {failed && !active.length && <span className="mono-label text-[9px] text-primary">Retry</span>}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
          {active.length > 0 && !open && (
            <div className="h-[2px] w-full bg-muted/40">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {open && (
            <ul className="border-t border-border/60 px-3 pb-1">
              {jobs.map((job) => <Row key={job.id} job={job} />)}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
