import { test } from "node:test";
import assert from "node:assert/strict";
import { createUploadQueue, isRetryable, pillText, UploadError, type UploadFile, type UploadJob } from "./uploadQueue.ts";

const file = (path: string, size = 10): UploadFile => ({ bucket: "media", path, file: new Blob([new Uint8Array(size)]) });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settle() { for (let i = 0; i < 20; i += 1) await tick(); }

function queueWith(send: (f: UploadFile, p: (r: number) => void) => Promise<string>, extra = {}) {
  const lingering: (() => void)[] = [];
  const queue = createUploadQueue({ transport: { send }, sleep: async () => undefined, later: (fn) => { lingering.push(fn); }, ...extra });
  return { queue, lingering };
}

test("a job uploads every file, then finishes with the URLs in order", async () => {
  const sent: string[] = [];
  const { queue, lingering } = queueWith(async (f, progress) => { progress(0.5); sent.push(f.path); return `https://cdn/${f.path}`; });
  let finished: string[] = [];
  let done = false;
  queue.enqueue({ label: "Photo post", files: [file("a"), file("b")], finish: async (urls) => { finished = urls; }, onDone: () => { done = true; } });
  await settle();
  assert.deepEqual(sent, ["a", "b"]);
  assert.deepEqual(finished, ["https://cdn/a", "https://cdn/b"]);
  assert.equal(done, true);
  assert.equal(queue.getSnapshot()[0].status, "done");
  assert.equal(queue.getSnapshot()[0].progress, 1);
  assert.equal(queue.busy(), false);
  lingering.forEach((fn) => fn());
  assert.equal(queue.getSnapshot().length, 0);
});

test("network failures retry on their own; retry later skips files already sent", async () => {
  const calls: string[] = [];
  let failB = 5;
  const { queue } = queueWith(async (f) => {
    calls.push(f.path);
    if (f.path === "b" && failB-- > 0) throw new Error("Network request failed");
    return `u/${f.path}`;
  });
  let failures = 0;
  const id = queue.enqueue({ label: "Video post", files: [file("a"), file("b")], finish: async () => undefined, onFail: () => { failures += 1; } });
  await settle();
  // one try plus two automatic retries for b, a sent once
  assert.deepEqual(calls, ["a", "b", "b", "b"]);
  const failed = queue.getSnapshot()[0];
  assert.equal(failed.status, "failed");
  assert.equal(failed.retryable, true);
  assert.equal(failures, 1);
  assert.equal(pillText(queue.getSnapshot()), "Video post didn't upload");
  failB = 0;
  queue.retry(id);
  await settle();
  assert.deepEqual(calls.slice(4), ["b"]);
  assert.equal(queue.getSnapshot()[0].status, "done");
});

test("rejections are not retried and dismiss abandons the placeholder", async () => {
  let calls = 0;
  const { queue } = queueWith(async () => { calls += 1; throw new UploadError("File too large", false); });
  let abandoned = false;
  const id = queue.enqueue({ label: "Story", files: [file("a")], finish: async () => undefined, onAbandon: () => { abandoned = true; } });
  await settle();
  assert.equal(calls, 1);
  const job = queue.getSnapshot()[0];
  assert.equal(job.retryable, false);
  queue.retry(id);
  await settle();
  assert.equal(calls, 1);
  queue.dismiss(id);
  assert.equal(abandoned, true);
  assert.equal(queue.getSnapshot().length, 0);
});

test("concurrency limits parallel jobs", async () => {
  let active = 0;
  let peak = 0;
  const { queue } = queueWith(async (f) => { active += 1; peak = Math.max(peak, active); await tick(); active -= 1; return f.path; }, { concurrency: 2 });
  for (const name of ["a", "b", "c", "d"]) queue.enqueue({ label: name, files: [file(name)], finish: async () => undefined });
  assert.equal(queue.busy(), true);
  await settle();
  assert.equal(peak, 2);
  assert.ok(queue.getSnapshot().every((job) => job.status === "done"));
});

test("progress is byte-weighted and holds below 100% until the post is saved", async () => {
  let release: () => void = () => undefined;
  const { queue } = queueWith(async (f, progress) => { progress(1); return f.path; });
  queue.enqueue({ label: "Video post", files: [file("big", 900), file("small", 100)], finish: () => new Promise<void>((resolve) => { release = resolve; }) });
  await settle();
  const saving = queue.getSnapshot()[0];
  assert.equal(saving.status, "saving");
  assert.ok(saving.progress <= 0.97);
  assert.equal(pillText(queue.getSnapshot()), "Finishing video post");
  release();
  await settle();
  assert.equal(pillText(queue.getSnapshot()), "Video post posted");
});

test("status codes decide retry", () => {
  assert.equal(isRetryable({ status: 413, message: "Payload too large" }), false);
  assert.equal(isRetryable({ statusCode: "403", message: "new row violates policy" }), false);
  assert.equal(isRetryable({ status: 401, message: "JWT expired" }), true);
  assert.equal(isRetryable({ status: 503 }), true);
  assert.equal(isRetryable(new TypeError("Failed to fetch")), true);
});

test("pill text summarises several jobs", () => {
  const job = (over: Partial<UploadJob>): UploadJob => ({ id: "x", label: "Photo post", status: "uploading", progress: 0.5, error: null, retryable: true, attempts: 1, ...over });
  assert.equal(pillText([job({}), job({ progress: 0.3 })]), "Posting 2 uploads · 40%");
  assert.equal(pillText([job({ status: "failed" }), job({ status: "failed" })]), "2 uploads failed");
  assert.equal(pillText([]), "");
});
