/**
 * Background uploads. A submit hands its files to this queue and returns, so
 * the person can keep using the app. The queue is a module singleton, so it
 * keeps running across route changes. Files already sent are not sent again
 * on retry, and a big video resumes from its last chunk.
 */

export type UploadStatus = "queued" | "uploading" | "saving" | "done" | "failed";

export interface UploadJob {
  id: string;
  label: string;
  status: UploadStatus;
  /** 0..1 across every file in the job. */
  progress: number;
  error: string | null;
  retryable: boolean;
  attempts: number;
}

export interface UploadFile {
  bucket: string;
  path: string;
  file: Blob;
}

export interface UploadTransport {
  /** Send one file and return its public URL. Throw an UploadError to fail. */
  send(file: UploadFile, onProgress: (ratio: number) => void): Promise<string>;
}

export interface UploadSpec {
  label: string;
  files: UploadFile[];
  /** Runs once every file is stored, with the public URLs in file order. */
  finish(urls: string[]): Promise<void>;
  onDone?(): void;
  /** Runs when a failed job is dismissed, so callers can remove placeholders. */
  onAbandon?(): void;
  /** Runs on each failure, retryable or not. */
  onFail?(error: unknown): void;
}

export class UploadError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
    this.name = "UploadError";
  }
}

/** Size, type and safety rejections fail the same way twice, so they get no Retry. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof UploadError) return error.retryable;
  // An expired session refreshes on its own, so the same request can succeed.
  if (/jwt|token.*expired/i.test(errorText(error))) return true;
  const status = Number((error as { status?: unknown; statusCode?: unknown } | null)?.status
    ?? (error as { statusCode?: unknown } | null)?.statusCode);
  if ([400, 401, 403, 409, 413, 415, 422].includes(status)) return false;
  return true;
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Upload failed";
}

interface Entry {
  job: UploadJob;
  spec: UploadSpec;
  urls: (string | null)[];
  fileProgress: number[];
}

export interface UploadQueueOptions {
  transport: UploadTransport;
  concurrency?: number;
  /** Automatic retries for network failures before Retry is shown. */
  autoRetries?: number;
  retryDelayMs?: number;
  doneLingerMs?: number;
  sleep?: (ms: number) => Promise<void>;
  later?: (fn: () => void, ms: number) => void;
}

export function createUploadQueue(options: UploadQueueOptions) {
  const {
    transport,
    concurrency = 2,
    autoRetries = 2,
    retryDelayMs = 1500,
    doneLingerMs = 3500,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    later = (fn, ms) => { setTimeout(fn, ms); },
  } = options;
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let snapshot: UploadJob[] = [];
  let running = 0;
  let serial = 0;

  const emit = () => {
    snapshot = [...entries.values()].map((entry) => ({ ...entry.job }));
    listeners.forEach((listener) => listener());
  };

  const patch = (entry: Entry, next: Partial<UploadJob>) => {
    entry.job = { ...entry.job, ...next };
    emit();
  };

  const weight = (entry: Entry) => entry.spec.files.map((file) => Math.max(1, file.file.size));

  const overall = (entry: Entry) => {
    const sizes = weight(entry);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    // The row insert is the last few percent, so 100% means the post exists.
    const sent = sizes.reduce((sum, size, index) => sum + size * entry.fileProgress[index], 0);
    return total ? Math.min(0.97, (sent / total) * 0.97) : 0;
  };

  const run = async (entry: Entry) => {
    running += 1;
    patch(entry, { status: "uploading", error: null, attempts: entry.job.attempts + 1 });
    try {
      for (let index = 0; index < entry.spec.files.length; index += 1) {
        if (entry.urls[index]) continue;
        let tries = 0;
        for (;;) {
          try {
            entry.urls[index] = await transport.send(entry.spec.files[index], (ratio) => {
              entry.fileProgress[index] = Math.max(0, Math.min(1, ratio));
              patch(entry, { progress: overall(entry) });
            });
            entry.fileProgress[index] = 1;
            patch(entry, { progress: overall(entry) });
            break;
          } catch (error) {
            if (!isRetryable(error) || tries >= autoRetries) throw error;
            tries += 1;
            await sleep(retryDelayMs * tries);
          }
        }
      }
      patch(entry, { status: "saving", progress: overall(entry) });
      await entry.spec.finish(entry.urls as string[]);
      patch(entry, { status: "done", progress: 1 });
      entry.spec.onDone?.();
      later(() => {
        if (entries.get(entry.job.id)?.job.status === "done") {
          entries.delete(entry.job.id);
          emit();
        }
      }, doneLingerMs);
    } catch (error) {
      patch(entry, { status: "failed", error: errorText(error), retryable: isRetryable(error) });
      entry.spec.onFail?.(error);
    } finally {
      running -= 1;
      pump();
    }
  };

  const pump = () => {
    for (const entry of entries.values()) {
      if (running >= concurrency) return;
      if (entry.job.status === "queued") void run(entry);
    }
  };

  return {
    enqueue(spec: UploadSpec): string {
      const id = `upload-${Date.now().toString(36)}-${++serial}`;
      entries.set(id, {
        job: { id, label: spec.label, status: "queued", progress: 0, error: null, retryable: true, attempts: 0 },
        spec,
        urls: spec.files.map(() => null),
        fileProgress: spec.files.map(() => 0),
      });
      emit();
      pump();
      return id;
    },
    retry(id: string) {
      const entry = entries.get(id);
      if (!entry || entry.job.status !== "failed" || !entry.job.retryable) return;
      patch(entry, { status: "queued", error: null });
      pump();
    },
    dismiss(id: string) {
      const entry = entries.get(id);
      if (!entry || entry.job.status === "uploading" || entry.job.status === "saving") return;
      entries.delete(id);
      if (entry.job.status !== "done") entry.spec.onAbandon?.();
      emit();
    },
    /** True while anything is still on its way. Used to warn before a reload. */
    busy(): boolean {
      return [...entries.values()].some((entry) => ["queued", "uploading", "saving"].includes(entry.job.status));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot(): UploadJob[] {
      return snapshot;
    },
  };
}

export type UploadQueue = ReturnType<typeof createUploadQueue>;

/** One-line status for the floating pill. */
export function pillText(jobs: readonly UploadJob[]): string {
  const failed = jobs.filter((job) => job.status === "failed");
  const active = jobs.filter((job) => job.status !== "done" && job.status !== "failed");
  if (active.length) {
    const progress = active.reduce((sum, job) => sum + job.progress, 0) / active.length;
    const percent = Math.round(progress * 100);
    const what = active.length === 1 ? active[0].label : `${active.length} uploads`;
    return active.some((job) => job.status === "saving") && percent >= 97 ? `Finishing ${what.toLowerCase()}` : `Posting ${what.toLowerCase()} · ${percent}%`;
  }
  if (failed.length) return failed.length === 1 ? `${failed[0].label} didn't upload` : `${failed.length} uploads failed`;
  if (jobs.length) return jobs.length === 1 ? `${jobs[0].label} posted` : "All uploads posted";
  return "";
}
