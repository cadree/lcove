import assert from "node:assert/strict";
import { DEFAULT_EMAIL_FROM, sendWithResend } from "../_shared/email-queue-dispatch.mjs";
import { handleEmailQueueRequest } from "./handler.ts";

Deno.env.set("INTERNAL_FUNCTION_SECRET", "queue-test-secret");

const SECRET = "queue-test-secret";

type Call = { type: string; table?: string; name?: string; args?: Record<string, unknown>; row?: unknown };

function message(id: string, msgId: number, extra: Record<string, unknown> = {}) {
  return {
    msg_id: msgId,
    read_ct: 1,
    enqueued_at: new Date().toISOString(),
    message: {
      message_id: id,
      to: "person@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      label: "welcome",
      queued_at: new Date().toISOString(),
      ...extra,
    },
  };
}

function fakeSupabase(options: {
  queues?: Record<string, unknown[]>;
  failed?: { message_id: string }[];
  suppressed?: boolean;
}) {
  const calls: Call[] = [];
  const queues = options.queues ?? {};
  const supabase = {
    calls,
    from(table: string) {
      const query: { update?: unknown; filters: unknown[] } = { filters: [] };
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: unknown) {
          query.filters.push([column, value]);
          return api;
        },
        in(column: string, value: unknown) {
          query.filters.push([column, value]);
          return api;
        },
        insert(row: unknown) {
          calls.push({ type: "insert", table, row });
          return Promise.resolve({ error: null });
        },
        update(row: unknown) {
          query.update = row;
          return api;
        },
        single() {
          calls.push({ type: "select", table });
          return Promise.resolve({ data: { retry_after_until: null } });
        },
        maybeSingle() {
          calls.push({ type: "maybe", table, args: { filters: query.filters } });
          if (table === "suppressed_emails") {
            return Promise.resolve({ data: options.suppressed ? { id: "suppressed" } : null, error: null });
          }
          if (table === "email_unsubscribe_tokens") {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          if (query.update) {
            calls.push({ type: "update", table, row: query.update });
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          calls.push({ type: "failed-scan", table });
          return Promise.resolve({ data: options.failed ?? [], error: null }).then(resolve, reject);
        },
      };
      return api;
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ type: "rpc", name, args });
      if (name === "read_email_batch") {
        const queueName = String(args.queue_name);
        return Promise.resolve({ data: queues[queueName] ?? [], error: null });
      }
      return Promise.resolve({ data: 1, error: null });
    },
  };
  return supabase;
}

function request(secret?: string) {
  const headers = new Headers();
  if (secret) headers.set("x-internal-secret", secret);
  return new Request("https://example.test/process-email-queue", { method: "POST", headers });
}

Deno.test("missing x-internal-secret returns 401", async () => {
  let touched = false;
  const deps = {
    supabase: {
      from() {
        touched = true;
        throw new Error("supabase should not be called");
      },
      rpc() {
        touched = true;
        return Promise.reject(new Error("supabase should not be called"));
      },
    },
    sendEmail() {
      touched = true;
      return Promise.reject(new Error("resend should not be called"));
    },
  };
  const response = await handleEmailQueueRequest(request(), deps);
  assert.equal(response.status, 401);
  assert.equal(touched, false);
  const body = await response.json();
  assert.equal(body.error, "Unauthorized");
});

Deno.test("valid secret and an empty queue returns 200", async () => {
  const supabase = fakeSupabase({ queues: { auth_emails: [], transactional_emails: [] } });
  const sent: unknown[] = [];
  const response = await handleEmailQueueRequest(request(SECRET), {
    supabase,
    sendEmail(payload) {
      sent.push(payload);
      return Promise.resolve();
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { processed: 0 });
  assert.equal(sent.length, 0);
  assert.equal(supabase.calls.some((call) => call.name === "delete_email"), false);
});

Deno.test("mocked Resend send deletes, and failures move to the DLQ", async () => {
  const ok = message("msg-ok", 11);
  const denied = message("msg-denied", 22, { idempotency_key: "idem-denied" });
  const exhausted = message("msg-exhausted", 33);
  const supabase = fakeSupabase({
    queues: { auth_emails: [ok, denied, exhausted], transactional_emails: [] },
    failed: Array.from({ length: 5 }, () => ({ message_id: "msg-exhausted" })),
  });
  const sent: string[] = [];
  const fetches: { url: string; authorization: string; from: string; idempotency: string | null }[] = [];
  const response = await handleEmailQueueRequest(request(SECRET), {
    supabase,
    sleep() {
      return Promise.resolve();
    },
    sendEmail(payload) {
      return sendWithResend("resend-test-key", "", payload, (url, init) => {
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body)) as { from: string };
        const id = String(payload.message_id);
        sent.push(id);
        fetches.push({
          url: String(url),
          authorization: headers.get("authorization") ?? "",
          from: body.from,
          idempotency: headers.get("idempotency-key"),
        });
        if (id === "msg-denied") {
          return Promise.resolve(new Response("emails disabled", { status: 403 }));
        }
        return Promise.resolve(new Response("{}", { status: 200 }));
      });
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  // 403 stops the batch after the DLQ write, so the exhausted message waits for the next read.
  assert.deepEqual(sent, ["msg-ok", "msg-denied"]);
  assert.equal(fetches.length, 2);
  assert.equal(fetches[0].url, "https://api.resend.com/emails");
  assert.equal(fetches[0].authorization, "Bearer resend-test-key");
  assert.equal(fetches[0].from, DEFAULT_EMAIL_FROM);
  assert.equal(fetches[1].idempotency, "idem-denied");
  assert.equal(body.processed, 1);
  assert.equal(body.stopped, "emails_disabled");

  const deletes = supabase.calls.filter((call) => call.name === "delete_email");
  assert.equal(deletes.length, 1);
  assert.equal(deletes[0].args?.message_id, 11);

  const dlq = supabase.calls.filter((call) => call.name === "move_to_dlq");
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].args?.message_id, 22);
  assert.equal(dlq[0].args?.dlq_name, "auth_emails_dlq");

  const sentLog = supabase.calls.find(
    (call) => call.type === "insert" && (call.row as { message_id?: string; status?: string })?.status === "sent",
  );
  assert.equal((sentLog?.row as { message_id: string }).message_id, "msg-ok");
});

Deno.test("five failed sends move the message to the DLQ without calling Resend", async () => {
  const exhausted = message("msg-exhausted", 33);
  const supabase = fakeSupabase({
    queues: { auth_emails: [exhausted], transactional_emails: [] },
    failed: Array.from({ length: 5 }, () => ({ message_id: "msg-exhausted" })),
  });
  let sends = 0;
  const response = await handleEmailQueueRequest(request(SECRET), {
    supabase,
    sendEmail() {
      sends += 1;
      return Promise.resolve();
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { processed: 0 });
  assert.equal(sends, 0);
  const dlq = supabase.calls.filter((call) => call.name === "move_to_dlq");
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].args?.message_id, 33);
  assert.equal(dlq[0].args?.source_queue, "auth_emails");
});
