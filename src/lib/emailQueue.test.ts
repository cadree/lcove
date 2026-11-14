import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runEmailQueue } from "../../supabase/functions/_shared/email-queue-dispatch.mjs";

function message(id: string, msgId: number) {
  return {
    msg_id: msgId,
    read_ct: 1,
    enqueued_at: new Date().toISOString(),
    message: {
      message_id: id,
      to: `${id}@staging.ether.test`,
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      label: "event-invite",
      queued_at: new Date().toISOString(),
    },
  };
}

function fakeSupabase(queues: Record<string, unknown[]>) {
  const calls: { type: string; name?: string; args?: Record<string, unknown>; row?: { status?: string; message_id?: string } }[] = [];
  const supabase = {
    calls,
    from(table: string) {
      const query: { update?: unknown } = {};
      const api = {
        select() {
          return api;
        },
        eq() {
          return api;
        },
        in() {
          return api;
        },
        insert(row: { status?: string; message_id?: string }) {
          calls.push({ type: "insert", row });
          return Promise.resolve({ error: null });
        },
        update(row: unknown) {
          query.update = row;
          return api;
        },
        single() {
          return Promise.resolve({ data: { retry_after_until: null } });
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          if (query.update) {
            calls.push({ type: "update" });
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      void table;
      return api;
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ type: "rpc", name, args });
      if (name === "read_email_batch") {
        return Promise.resolve({ data: queues[String(args.queue_name)] ?? [], error: null });
      }
      return Promise.resolve({ data: 1, error: null });
    },
  };
  return supabase;
}

describe("email queue", () => {
  it("dead-letters one Resend 403 and still sends the other messages", async () => {
    const supabase = fakeSupabase({
      auth_emails: [message("ok", 1), message("denied", 2)],
      transactional_emails: [message("later", 3)],
    });
    const sent: string[] = [];
    const response = await runEmailQueue({
      supabase,
      sleep() {
        return Promise.resolve();
      },
      sendEmail(payload: { message_id?: string }) {
        sent.push(String(payload.message_id));
        if (payload.message_id === "denied") {
          const error = new Error("Emails disabled for this project");
          (error as Error & { status?: number }).status = 403;
          return Promise.reject(error);
        }
        return Promise.resolve();
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(sent, ["ok", "denied", "later"]);
    assert.deepEqual(body, { processed: 2 });
    const dlq = supabase.calls.filter((call) => call.name === "move_to_dlq");
    assert.equal(dlq.length, 1);
    assert.equal(dlq[0].args?.message_id, 2);
    const deletes = supabase.calls.filter((call) => call.name === "delete_email").map((call) => call.args?.message_id);
    assert.deepEqual(deletes, [1, 3]);
  });
});
