import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { withAuthDeadline } from "./authFetchDeadline.ts";

const hang: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

describe("auth fetch deadline", () => {
  // Node 22 does not keep the process alive for AbortSignal.timeout, so the
  // runner would exit before the deadline fires. Hold the event loop open.
  let keepAlive: ReturnType<typeof setInterval>;
  before(() => {
    keepAlive = setInterval(() => {}, 1_000);
  });
  after(() => clearInterval(keepAlive));

  it("fails a hung token refresh instead of waiting forever", async () => {
    const fetchWithDeadline = withAuthDeadline(hang, 30);
    await assert.rejects(
      fetchWithDeadline("https://x.supabase.co/auth/v1/token?grant_type=refresh_token", { method: "POST" }),
      { name: "AbortError" },
    );
  });

  it("leaves uploads and queries without a deadline", async () => {
    let seen: AbortSignal | null | undefined = null;
    const spy: typeof fetch = async (_input, init) => {
      seen = init?.signal;
      return new Response("[]");
    };
    await withAuthDeadline(spy, 30)("https://x.supabase.co/storage/v1/object/posts/a.mp4", { method: "POST" });
    assert.equal(seen, undefined);
  });

  it("still honors the caller's own abort", async () => {
    const controller = new AbortController();
    const pending = withAuthDeadline(hang, 60_000)("https://x.supabase.co/auth/v1/user", { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
  });
});
