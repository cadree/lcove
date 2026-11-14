import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,display_name text,avatar_url text,bio text,city text,city_display text,city_key text,onboarding_completed boolean DEFAULT true,access_status text DEFAULT 'active',is_suspended boolean DEFAULT false);
 CREATE VIEW public.profiles_public AS SELECT * FROM public.profiles;
 CREATE TABLE public.conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),type text NOT NULL,name text,created_by uuid,project_id uuid,visibility text DEFAULT 'private',is_community_hub boolean DEFAULT false,created_at timestamptz DEFAULT now());
 CREATE TABLE public.conversation_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES public.conversations(id),user_id uuid,is_muted boolean DEFAULT false,UNIQUE(conversation_id,user_id));
 CREATE TABLE public.messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid,sender_id uuid,content text,deleted_at timestamptz);
 CREATE FUNCTION public.purge_user_personal_data(target uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN DELETE FROM public.conversation_participants WHERE user_id=target; END $$;
 CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
 CREATE TABLE public.collab_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid NOT NULL,recipient_id uuid NOT NULL,status text NOT NULL DEFAULT 'pending',conversation_id uuid);
 CREATE FUNCTION public.either_blocked(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.user_blocks WHERE (blocker_id=a AND blocked_id=b) OR (blocker_id=b AND blocked_id=a)) $$;
 CREATE FUNCTION public.has_blocked(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.user_blocks WHERE blocker_id=a AND blocked_id=b) $$;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.conversations,public.conversation_participants,public.messages TO authenticated;
`);
const moderation = await readFile(
  "supabase/migrations/20261020181000_app_store_readiness.sql",
  "utf8"
);
await db.exec(
  moderation.slice(
    moderation.indexOf("CREATE OR REPLACE FUNCTION public.objectionable_text"),
    moderation.indexOf(
      "CREATE OR REPLACE FUNCTION public.reject_objectionable_text"
    )
  )
);
const old = await readFile(
  "supabase/migrations/20261020220000_story_like_notices_and_direct_chats.sql",
  "utf8"
);
await db.exec(
  old.slice(
    old.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation"
    )
  )
);
for (const file of [
  "20261114090000_creative_discovery.sql",
  "20261114091000_travel_pledges.sql",
])
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
const ids = Array.from(
  { length: 5 },
  (_, i) => `00000000-0000-0000-0000-00000000000${i + 1}`
);
for (const [i, id] of ids.entries())
  await db.query(`INSERT INTO auth.users VALUES($1);`, [id]);
for (const [i, id] of ids.entries())
  await db.query(
    `INSERT INTO public.profiles(user_id,display_name,city,city_key) VALUES($1,$2,'Atlanta, GA','atlanta|ga')`,
    [id, `Creative ${i}`]
  );
async function as(id) {
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [id]);
}
async function rpc(name, args = []) {
  const sql = `SELECT public.${name}(${args
    .map((_, i) => `$${i + 1}`)
    .join(",")}) value`;
  return (await db.query(sql, args)).rows[0].value;
}
async function fails(fn, pattern) {
  await assert.rejects(fn, pattern);
}
let checks = 0;
const check = (label) => {
  checks++;
  console.log(`ok ${checks} - ${label}`);
};
await as(ids[0]);
assert.deepEqual((await rpc("discovery_people")).people, []);
check("discovery is opt-in");
for (const id of ids) {
  await as(id);
  await rpc("discovery_settings", [true, true]);
}
await as(ids[0]);
await fails(
  () => rpc("get_or_create_direct_conversation", [ids[1]]),
  /mutual matches/
);
check("legacy direct creation cannot bypass locked DMs");
const first = await rpc("creative_swipe", [ids[1], true]);
assert.equal(first.matched, false);
await as(ids[1]);
const match = await rpc("creative_swipe", [ids[0], true]);
assert.equal(match.matched, true);
assert.ok(match.conversation_id);
assert.equal(
  (await rpc("creative_swipe", [ids[0], true])).conversation_id,
  match.conversation_id
);
check("reciprocal likes create one chat; repeated requests reuse it");
await db.query(
  "INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,$3)",
  [match.conversation_id, ids[1], "hello"]
);
await rpc("creative_unmatch", [ids[0]]);
await fails(
  () =>
    db.query(
      "INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,$3)",
      [match.conversation_id, ids[1], "bypass"]
    ),
  /mutual matches/
);
check("unmatch blocks old-chat sends to locked recipients");
await db.query(
  "UPDATE public.conversation_participants SET is_muted=true WHERE conversation_id=$1 AND user_id=$2",
  [match.conversation_id, ids[1]]
);
check(
  "unmatched users can still mute and maintain their existing chat participation"
);
await as(ids[0]);
await rpc("creative_swipe", [ids[1], true]);
await as(ids[1]);
await rpc("creative_swipe", [ids[0], true]);
await db.query("INSERT INTO public.user_blocks VALUES($1,$2)", [
  ids[0],
  ids[1],
]);
assert.equal((await rpc("creative_match_list")).length, 0);
await db.query("DELETE FROM public.user_blocks");
assert.equal((await rpc("creative_match_list")).length, 0);
check("blocking clears match and unblocking does not restore it");
await db.exec("SET ROLE authenticated");
await fails(
  () =>
    db.query(
      "INSERT INTO public.creative_matches(first_id,second_id) VALUES($1,$2)",
      [ids[0], ids[1]]
    ),
  /permission denied/
);
await fails(
  () =>
    db.query(
      "UPDATE public.discovery_preferences SET matches_only=false WHERE user_id=$1",
      [ids[0]]
    ),
  /permission denied/
);
await db.exec("RESET ROLE");
check("clients cannot forge matches or change another user’s preferences");
await as(ids[0]);
let t = await rpc("creative_trip_action", [
  "create",
  null,
  {
    title: "Creative weekend",
    city_key: "atlanta|ga",
    city_label: "Atlanta, GA",
    starts_on: "2099-01-01",
    ends_on: "2099-01-05",
    capacity: 4,
    notes: "Split all costs. Discuss cancellations.",
  },
]);
const tid = t.id;
const action = (name, data = {}) =>
  rpc("creative_trip_action", [name, tid, data]);
await as(ids[1]);
t = await action("join");
assert.equal(t.members.length, 2);
t = await action("join");
assert.equal(t.members.length, 2);
check(
  "explicit join is idempotent and adds a locked-DM user only to the trip group"
);
await fails(
  () => rpc("get_or_create_direct_conversation", [ids[0]]),
  /mutual matches/
);
check("trip membership does not unlock personal DMs");
await as(ids[2]);
await fails(() => rpc("creative_trip_snapshot", [tid]), /Join this trip/);
await fails(
  () =>
    db.query(
      "INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2)",
      [t.conversation_id, ids[2]]
    ),
  /Join through the trip planner/
);
check("non-members cannot read budgets or inject chat membership");
await as(ids[0]);
t = await action("add_item", { label: "Lodging", estimate_cents: 150000 });
t = await action("add_item", { label: "Car rental", estimate_cents: 50000 });
assert.equal(t.total_cents, 200000);
assert.equal(t.members[0].share_cents, 100000);
await fails(
  () =>
    action("record_receipt", {
      item_id: t.items[0].id,
      revision: t.revision,
      actual_cents: 150000,
      receipt_url: "https://example.com/receipt",
    }),
  /Everyone must approve/
);
check("receipts require unanimous approval of a funded pledge plan");
for (const id of ids.slice(0, 2)) {
  await as(id);
  await action("pledge", { cents: 100000 });
  t = await action("approve_budget", { revision: t.revision });
}
const priorRevision = t.revision;
await as(ids[2]);
t = await action("join");
assert.ok(t.revision > priorRevision);
assert.ok(
  t.members.every((m) => m.approved_revision === null && m.pledge_cents === 0)
);
await fails(
  () => action("approve_budget", { revision: priorRevision }),
  /Budget changed/
);
check("roster changes invalidate pledges and stale approvals");
assert.equal(
  t.members.reduce((sum, m) => sum + m.share_cents, 0),
  200000
);
assert.equal(t.members[0].share_cents, 66667);
check("equal split preserves every cent");
await as(ids[1]);
await fails(
  () => action("add_item", { label: "Forged", estimate_cents: 10 }),
  /Only the organizer/
);
await fails(
  () => action("pledge", { cents: 100000 }),
  /between zero and your share/
);
check(
  "non-organizers cannot edit budgets; contributions cannot exceed own share"
);
for (const m of t.members) {
  await as(m.user_id);
  await action("pledge", { cents: m.share_cents });
  t = await action("approve_budget", { revision: t.revision });
}
await as(ids[0]);
const item = t.items.find((i) => i.label === "Lodging");
await fails(
  () =>
    action("record_receipt", {
      item_id: item.id,
      revision: t.revision,
      actual_cents: 160000,
      receipt_url: "https://example.com/receipt",
    }),
  /within the approved estimate/
);
t = await action("record_receipt", {
  item_id: item.id,
  revision: t.revision,
  actual_cents: 145000,
  receipt_url: "https://example.com/receipt",
});
await fails(
  () => action("remove_item", { item_id: item.id }),
  /before bookings/
);
await as(ids[1]);
await fails(() => action("leave"), /recorded bookings/);
await as(ids[3]);
await fails(() => action("join"), /no longer accepting/);
check("recorded receipts freeze roster and budget; overspending is rejected");
await as(ids[0]);
await action("confirm_receipt", { item_id: item.id, approved: true });
await action("confirm_receipt", { item_id: item.id, approved: true });
t = await rpc("creative_trip_snapshot", [tid]);
assert.equal(t.items.find((i) => i.id === item.id).votes.length, 1);
assert.equal(t.status, "planning");
check("repeat receipt votes cannot manufacture unanimity");
await as(ids[1]);
t = await action("confirm_receipt", { item_id: item.id, approved: false });
assert.equal(t.status, "planning");
check("a disputed receipt cannot complete the booking");
await as(ids[0]);
await action("cancel");
await fails(() => action("report_paid", { cents: 10 }), /closed/);
check("cancelled trip preserves records and rejects further mutations");

await as(ids[0]);
await db.exec("SET ROLE authenticated");
assert.equal((await rpc("discovery_settings")).matches_only, true);
await fails(
  () => rpc("purge_user_personal_data", [ids[1]]),
  /permission denied/
);
await db.exec("RESET ROLE");
check(
  "authenticated preferences work while account purge remains service-only"
);
await as(ids[3]);
const beforeCount = (
  await db.query("SELECT count(*)::int n FROM public.conversations")
).rows[0].n;
assert.ok(
  await rpc("create_group_with_privacy", ["Private group", [ids[0], ids[1]]])
);
check("matches-only never blocks being added to a group chat");
const afterGroup = (
  await db.query("SELECT count(*)::int n FROM public.conversations")
).rows[0].n;
assert.equal(afterGroup, beforeCount + 1);
await fails(
  () =>
    rpc("create_group_with_privacy", [
      "Private group",
      [ids[0], "00000000-0000-0000-0000-0000000000ff"],
    ]),
  /Profile unavailable/
);
assert.equal(
  (await db.query("SELECT count(*)::int n FROM public.conversations")).rows[0]
    .n,
  afterGroup
);
check("failed private group invitation rolls back the entire group");
await as(ids[0]);
const fresh = await rpc("creative_trip_action", [
  "create",
  null,
  {
    title: "Deletion test",
    city_key: "madrid|es",
    city_label: "Madrid, Spain",
    starts_on: "2099-02-01",
    ends_on: "2099-02-05",
    capacity: 2,
  },
]);
await as(ids[4]);
await rpc("creative_trip_action", ["join", fresh.id, {}]);
await as(ids[0]);
await rpc("purge_user_personal_data", [ids[4]]);
await db.query("DELETE FROM auth.users WHERE id=$1", [ids[4]]);
assert.equal(
  (await rpc("creative_trip_snapshot", [fresh.id])).status,
  "cancelled"
);
assert.equal(
  (
    await db.query(
      "SELECT count(*)::int n FROM public.conversation_participants WHERE user_id=$1",
      [ids[4]]
    )
  ).rows[0].n,
  0
);
check("account deletion succeeds and cancels affected planning trips");
// Approved receipts require every member, including the organizer.
const completeTrip = await rpc("creative_trip_action", [
  "create",
  null,
  {
    title: "Receipt lifecycle",
    city_key: "madrid|es",
    city_label: "Madrid, Spain",
    starts_on: "2099-02-01",
    ends_on: "2099-02-05",
    capacity: 2,
  },
]);
const ca = (a, d = {}) => rpc("creative_trip_action", [a, completeTrip.id, d]);
await as(ids[2]);
await ca("join");
await as(ids[0]);
let ct = await ca("add_item", { label: "Hotel", estimate_cents: 101 });
for (const m of ct.members) {
  await as(m.user_id);
  await ca("pledge", { cents: m.share_cents });
  ct = await ca("approve_budget", { revision: ct.revision });
}
await as(ids[0]);
ct = await ca("record_receipt", {
  item_id: ct.items[0].id,
  revision: ct.revision,
  actual_cents: 100,
  receipt_url: "https://example.com/receipt",
});
ct = await ca("confirm_receipt", { item_id: ct.items[0].id, approved: true });
assert.equal(ct.status, "planning");
await as(ids[2]);
ct = await ca("confirm_receipt", { item_id: ct.items[0].id, approved: true });
assert.equal(ct.status, "booked");
ct = await ca("confirm_receipt", { item_id: ct.items[0].id, approved: false });
assert.equal(ct.status, "planning");
check(
  "only unanimous receipt confirmation marks bookings complete; disputes reopen them"
);
await as(ids[0]);
await fails(
  () =>
    db.query(
      "UPDATE public.conversations SET visibility='public' WHERE id=$1",
      [completeTrip.conversation_id]
    ),
  /must stay private/
);
check("trip organizer cannot expose the group as a public collective");

await db.exec(`
 ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
 CREATE POLICY fixture_legacy_conversations ON public.conversations FOR SELECT USING(true);
 CREATE POLICY fixture_legacy_participants ON public.conversation_participants FOR SELECT USING(true);
 CREATE POLICY fixture_legacy_messages ON public.messages FOR SELECT USING(true);
`);
await as(ids[3]);
await db.exec("SET ROLE authenticated");
assert.equal(
  (
    await db.query("SELECT id FROM public.conversations WHERE id=$1", [
      completeTrip.conversation_id,
    ])
  ).rows.length,
  0
);
assert.equal(
  (
    await db.query(
      "SELECT id FROM public.conversation_participants WHERE conversation_id=$1",
      [completeTrip.conversation_id]
    )
  ).rows.length,
  0
);
await db.exec("RESET ROLE");
check(
  "restrictive trip policies override permissive legacy chat read policies"
);

await as(ids[0]);
const retryPlan = {
  request_id: "11111111-1111-4111-8111-111111111111",
  title: "Repeat create",
  city_key: "atlanta|ga",
  city_label: "Atlanta, GA",
  starts_on: "2099-03-01",
  ends_on: "2099-03-02",
  capacity: 4,
};
const createdOnce = await rpc("creative_trip_action", [
  "create",
  null,
  retryPlan,
]);
const createdTwice = await rpc("creative_trip_action", [
  "create",
  null,
  retryPlan,
]);
assert.equal(createdOnce.id, createdTwice.id);
assert.equal(createdOnce.conversation_id, createdTwice.conversation_id);
check("retried trip creation reuses its trip and group chat");
await fails(
  () =>
    rpc("creative_trip_action", [
      "create",
      null,
      { ...retryPlan, request_id: null, title: "xxx" },
    ]),
  /not allowed/
);
check("trip text uses the existing server moderation filter");
await fails(()=>rpc('create_group_with_privacy',[null,[ids[1],ids[2]]]),/Add a group name/);
await fails(()=>rpc('create_group_with_privacy',['Named group',null]),/Add a group name/);
check('raw group creation rejects null names and participant arrays');

// ---- PR #87 review fixes: items 2-5 ----
const more = Array.from({ length: 4 }, (_, i) => `00000000-0000-0000-0000-0000000001${i}0`);
for (const id of more) {
  await db.query(`INSERT INTO auth.users VALUES($1);`, [id]);
  await db.query(
    `INSERT INTO public.profiles(user_id,display_name,city,city_key) VALUES($1,'Member','Atlanta, GA','atlanta|ga')`,
    [id]
  );
}
const [host, locked, open, other] = more;
await as(locked);
await rpc("discovery_settings", [false, true]);
await as(open);
await rpc("discovery_settings", [false, false]);
const sql = (q, p = []) => db.query(q, p);
const newConv = async (type, by, projectId = null) =>
  (
    await sql(
      "INSERT INTO public.conversations(type,created_by,project_id) VALUES($1,$2,$3) RETURNING id",
      [type, by, projectId]
    )
  ).rows[0].id;
// Item 2: groups are never gated by matches-only.
await as(host);
let chat = await newConv("group", host);
await sql(
  "INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2),($1,$3),($1,$4)",
  [chat, host, locked, open]
);
check("event host can start an attendee group chat that includes a matches-only member");
chat = await newConv("group", host);
await sql("INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2)", [chat, host]);
await sql("INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2)", [chat, locked]);
await sql("INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,'welcome')", [chat, host]);
check("collective owner can approve a matches-only member's join request and message the group");
await as("");
chat = await newConv("group", host);
await sql(
  "INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2),($1,$3)",
  [chat, host, locked]
);
check("server-side adds (no auth.uid) are not gated");
await as(host);
await fails(() => rpc("get_or_create_direct_conversation", [locked]), /mutual matches/);
check("matches-only still blocks a new personal DM");
await sql(
  "INSERT INTO public.collab_invites(sender_id,recipient_id) VALUES($1,$2)",
  [host, locked]
);
await as(locked);
chat = await newConv("direct", locked);
await sql(
  "INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2),($1,$3)",
  [chat, locked, host]
);
await sql("UPDATE public.collab_invites SET status='accepted',conversation_id=$1 WHERE sender_id=$2", [chat, host]);
await as(host);
await sql("INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,'thanks for accepting')", [chat, host]);
check("accepting a collab invite opens and keeps a DM with a matches-only member");
// Item 3: project client chats are not personal DMs.
await as(host);
chat = await newConv("direct", host, "00000000-0000-0000-0000-00000000a001");
await sql(
  "INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2),($1,$3)",
  [chat, host, locked]
);
await sql("INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,'project update')", [chat, host]);
check("project client chat adds and messages a matches-only client");
// Item 5: the personal DM lock is two-way.
await as("");
chat = await newConv("direct", locked);
await sql(
  "INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2),($1,$3)",
  [chat, locked, open]
);
await as(locked);
await fails(
  () => sql("INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,'one way')", [chat, locked]),
  /mutual matches/
);
await as(open);
await fails(
  () => sql("INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,'reply')", [chat, open]),
  /mutual matches/
);
check("a matches-only member cannot keep messaging an unmatched DM partner who cannot reply");
// Item 4: members can leave the chat of a cancelled or completed trip.
await as(host);
const closedTrip = await rpc("creative_trip_action", [
  "create",
  null,
  { title: "Closed trip", city_key: "atlanta|ga", city_label: "Atlanta, GA", starts_on: "2099-03-01", ends_on: "2099-03-03", capacity: 4 },
]);
await as(open);
await rpc("creative_trip_action", ["join", closedTrip.id, {}]);
await as(other);
await rpc("creative_trip_action", ["join", closedTrip.id, {}]);
await as(host);
await rpc("creative_trip_action", ["cancel", closedTrip.id, {}]);
await as(open);
assert.deepEqual(await rpc("creative_trip_action", ["leave", closedTrip.id, {}]), { left: true });
const inChat = async (id) =>
  (await sql("SELECT count(*)::int n FROM public.conversation_participants WHERE conversation_id=$1 AND user_id=$2", [closedTrip.conversation_id, id])).rows[0].n;
assert.equal(await inChat(open), 0);
await fails(
  () => sql("INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES($1,$2)", [closedTrip.conversation_id, open]),
  /closed/
);
await as(other);
await sql("DELETE FROM public.conversation_participants WHERE conversation_id=$1 AND user_id=$2", [closedTrip.conversation_id, other]);
assert.equal(await inChat(other), 0);
await fails(() => rpc("creative_trip_action", ["report_paid", closedTrip.id, { cents: 1 }]), /closed/);
check("members can leave a cancelled trip's chat (planner or chat), cannot rejoin, and the trip stays closed");
await db.close();
console.log(`${checks} database checks passed`);
