import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVAL_PUSH_PATH,
  approvalPushOutcome,
  approvalPushPayload,
  dispatchMemberApprovalPushes,
} from "../supabase/functions/_shared/member-approval-push.mjs";

const member = "00000000-0000-4000-8000-000000000301";

function backend({ profile, jobs, push }) {
  const calls = { acks: [], dlq: [], sent: [] };
  const supabase = {
    rpc: async (name, args) => {
      if (name === "read_email_batch") {
        assert.equal(args.queue_name, "member_approval_pushes");
        return { data: jobs, error: null };
      }
      if (name === "delete_email") { calls.acks.push(args.message_id); return { data: true, error: null }; }
      if (name === "move_to_dlq") { calls.dlq.push(args.message_id); return { data: 1, error: null }; }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table) => {
      assert.equal(table, "profiles");
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: profile, error: null }) };
      return q;
    },
  };
  const deliverPush = async (payload) => { calls.sent.push(payload); return push(payload); };
  return { supabase, deliverPush, calls };
}
const quiet = { error: () => {} };
const active = { user_id: member, display_name: "Kloudy Waves", onboarding_completed: true, access_status: "active" };

test("approved member gets one push that opens Explore; job is acknowledged", async () => {
  const h = backend({ profile: active, jobs: [{ msg_id: 7, read_ct: 1, message: { applicant_id: member } }], push: () => ({ success: true, sent: 1 }) });
  await dispatchMemberApprovalPushes({ ...h, logger: quiet });
  assert.equal(h.calls.sent.length, 1);
  assert.deepEqual(h.calls.sent[0], {
    user_id: member,
    title: "You're approved",
    body: "Welcome to ETHER, Kloudy. Tap to meet creatives near you.",
    url: APPROVAL_PUSH_PATH,
    notification_type: "membership_accepted",
    data: { applicant_id: member },
  });
  assert.equal(APPROVAL_PUSH_PATH, "/explore?section=people");
  assert.deepEqual(h.calls.acks, [7]);
});

test("no device on file or push switched off: acknowledged, not retried", async () => {
  for (const response of [{ message: "No push subscriptions", sent: 0 }, { message: "Push notifications disabled" }]) {
    const h = backend({ profile: active, jobs: [{ msg_id: 8, read_ct: 1, message: { applicant_id: member } }], push: () => response });
    await dispatchMemberApprovalPushes({ ...h, logger: quiet });
    assert.deepEqual(h.calls.acks, [8]);
  }
});

test("failed send is retried, then dead-lettered after five reads", async () => {
  const failed = () => ({ success: false, sent: 0, results: [{ endpoint: "apns", status: "failed" }] });
  let h = backend({ profile: active, jobs: [{ msg_id: 9, read_ct: 2, message: { applicant_id: member } }], push: failed });
  await dispatchMemberApprovalPushes({ ...h, logger: quiet });
  assert.deepEqual(h.calls.acks, []);
  assert.deepEqual(h.calls.dlq, []);
  h = backend({ profile: active, jobs: [{ msg_id: 9, read_ct: 5, message: { applicant_id: member } }], push: () => { throw new Error("network"); } });
  await dispatchMemberApprovalPushes({ ...h, logger: quiet });
  assert.deepEqual(h.calls.dlq, [9]);
});

test("approval reversed or bad job: no push, acknowledged", async () => {
  let h = backend({ profile: { ...active, access_status: "banned" }, jobs: [{ msg_id: 10, read_ct: 1, message: { applicant_id: member } }], push: () => ({ sent: 1 }) });
  await dispatchMemberApprovalPushes({ ...h, logger: quiet });
  assert.equal(h.calls.sent.length, 0);
  assert.deepEqual(h.calls.acks, [10]);
  h = backend({ profile: active, jobs: [{ msg_id: 11, read_ct: 1, message: { applicant_id: "nope" } }], push: () => ({ sent: 1 }) });
  await dispatchMemberApprovalPushes({ ...h, logger: quiet });
  assert.equal(h.calls.sent.length, 0);
  assert.deepEqual(h.calls.acks, [11]);
});

test("outcome and copy helpers", () => {
  assert.equal(approvalPushOutcome({ error: "boom" }), "retry");
  assert.equal(approvalPushOutcome(null), "retry");
  assert.equal(approvalPushOutcome({ sent: 2 }), "done");
  assert.equal(approvalPushPayload({ user_id: member, display_name: "" }).body, "Welcome to ETHER. Tap to meet creatives near you.");
});
