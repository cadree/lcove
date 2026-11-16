import assert from "node:assert/strict";
import test from "node:test";
import { dispatchMemberApplicationPushes } from "../supabase/functions/_shared/member-application-push.mjs";

function fakeBackend() {
  const applicantId = "00000000-0000-4000-8000-000000000101";
  const reviewer = "00000000-0000-4000-8000-000000000102";
  const uninterestedAdmin = "00000000-0000-4000-8000-000000000103";
  const ordinaryUser = "00000000-0000-4000-8000-000000000104";
  const db = {
    profiles: [{ user_id: applicantId, display_name: "Ada", onboarding_completed: true, access_status: "pending" }],
    user_roles: [
      { user_id: reviewer, role: "admin" },
      { user_id: uninterestedAdmin, role: "admin" },
      { user_id: ordinaryUser, role: "user" },
    ],
    notification_preferences: [
      { user_id: reviewer, push_enabled: true, new_member_applications_push_enabled: true },
      { user_id: uninterestedAdmin, push_enabled: true, new_member_applications_push_enabled: false },
      { user_id: ordinaryUser, push_enabled: true, new_member_applications_push_enabled: true },
    ],
    application_push_deliveries: [],
  };
  const sent = [];
  const acknowledgements = [];
  let jobs = [{ msg_id: 1, read_ct: 1, message: { applicant_id: applicantId } }];

  const supabase = {
    rpc: async (name, args) => {
      if (name === "read_email_batch") return { data: jobs, error: null };
      if (name === "delete_email") {
        acknowledgements.push(args.message_id);
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table) => {
      const filters = [];
      const read = () => (db[table] || []).filter((row) => filters.every(([field, condition, value]) =>
        condition === "eq" ? row[field] === value : value.includes(row[field])));
      const query = {
        select: () => query,
        eq: (field, value) => { filters.push([field, "eq", value]); return query; },
        in: (field, values) => { filters.push([field, "in", values]); return query; },
        maybeSingle: async () => ({ data: read()[0] ?? null, error: null }),
        insert: async (row) => {
          db[table].push(row);
          return { data: row, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: read(), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return {
    applicantId, reviewer, db, sent, acknowledgements, supabase,
    sendPush: async (payload) => { sent.push(payload); },
    setJobs: (next) => { jobs = next; },
  };
}

test("new member application push goes only to admins opted in and is not repeated", async () => {
  const h = fakeBackend();
  await dispatchMemberApplicationPushes({ supabase: h.supabase, sendPush: h.sendPush });
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].user_id, h.reviewer);
  assert.equal(h.sent[0].notification_type, "member_application");
  assert.equal(h.sent[0].url, `/admin/onboarding/${h.applicantId}`);
  assert.deepEqual(h.acknowledgements, [1]);

  // If a claimed job appears again, the delivery ledger prevents a duplicate.
  await dispatchMemberApplicationPushes({ supabase: h.supabase, sendPush: h.sendPush });
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.acknowledgements, [1, 1]);
});

test("admin who switches push off gets no application alerts", async () => {
  const h = fakeBackend();
  h.db.notification_preferences[0].new_member_applications_push_enabled = false;
  await dispatchMemberApplicationPushes({ supabase: h.supabase, sendPush: h.sendPush });
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.acknowledgements, [1]);
});

test("already approved applicant does not generate a stale review alert", async () => {
  const h = fakeBackend();
  h.db.profiles[0].access_status = "active";
  await dispatchMemberApplicationPushes({ supabase: h.supabase, sendPush: h.sendPush });
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.acknowledgements, [1]);
});

test("failed send keeps application job for retry", async () => {
  const h = fakeBackend();
  await dispatchMemberApplicationPushes({
    supabase: h.supabase,
    sendPush: async () => { throw new Error("APNs temporarily unavailable"); },
    logger: { error() {} },
  });
  assert.equal(h.db.application_push_deliveries.length, 0);
  assert.deepEqual(h.acknowledgements, []);
});
