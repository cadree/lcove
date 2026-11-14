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
  "20261114120000_people_discovery_v2.sql",
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
assert.equal((await rpc("discovery_people")).people.length, ids.length - 1);
assert.equal((await rpc("discovery_globe")).length, ids.length);
check("every eligible member is discoverable at their profile city by default");
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

// People discovery v2: default-visible profile cities, opt-out, live city, travel badges.
const v2 = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-9000-00000000000${i + 1}`);
const [ana, ben, cai, dee, eli] = v2;
for (const [i, id] of v2.entries()) {
  await sql("INSERT INTO auth.users VALUES($1)", [id]);
  await sql("INSERT INTO public.profiles(user_id,display_name,city,city_key) VALUES($1,$2,'Charlotte, NC','charlotte|nc')", [id, `V2 ${i}`]);
}
const globe = async (viewer) => { await as(viewer); return rpc("discovery_globe"); };
const seen = async (viewer, id) => (await globe(viewer)).find((p) => p.user_id === id);
assert.ok(await seen(ana, ben));
assert.equal((await sql("SELECT count(*)::int n FROM public.discovery_preferences WHERE user_id=$1", [ben])).rows[0].n, 0);
check("v2: a member with no preference row is on the globe");
await as(ben);
assert.equal((await rpc("discovery_settings", [false, null])).discoverable, false);
assert.equal(await seen(ana, ben), undefined);
await as(ana);
assert.equal((await rpc("discovery_people", [null, "V2 1", 0])).people.length, 0);
await fails(() => rpc("creative_swipe", [ben, true]), /unavailable/);
await as(ben);
await fails(() => rpc("creative_swipe", [ana, true]), /Show yourself in discovery/);
await fails(() => rpc("discovery_live_city", ["charlotte|nc", 24]), /Show yourself in discovery/);
check("v2: the hide-me opt-out removes a member from globe, deck and old discovery, and blocks their swipes");
await as(cai);
let me = await rpc("discovery_live_city", ["miami|fl", 24]);
assert.equal(me.live_city_key, "miami|fl");
const live = await seen(ana, cai);
assert.equal(live.live_city_key, "miami|fl");
assert.ok(new Date(live.live_until) > new Date(Date.now() + 23 * 3600e3));
assert.equal(Object.keys(live).some((k) => /lat|lon|coord/i.test(k)), false);
check("v2: an opted-in live city is visible to others as a city key with an expiry, never coordinates");
for (const [key, hours, pattern] of [["miami|fl", 0, /1 hour to 7 days/], ["miami|fl", 169, /1 hour to 7 days/], ["Miami, FL", 4, /Choose a city/], ["miami|florida", 4, /Choose a city/], ["x|fl'; drop", 4, /Choose a city/]])
  await fails(() => rpc("discovery_live_city", [key, hours]), pattern);
check("v2: live city rejects bad durations and anything that is not a city key");
await sql("UPDATE public.discovery_live_cities SET expires_at=now()-interval '1 minute' WHERE user_id=$1", [cai]);
assert.equal((await seen(ana, cai)).live_city_key, null);
await as(cai);
assert.equal((await rpc("discovery_settings")).live_city_key, null);
await rpc("discovery_live_city", ["miami|fl", 2]);
assert.equal((await seen(ana, cai)).live_city_key, "miami|fl");
await as(cai);
assert.equal((await rpc("discovery_live_city", [null, null])).live_city_key, null);
assert.equal((await seen(ana, cai)).live_city_key, null);
await as(cai);
await rpc("discovery_live_city", ["miami|fl", 2]);
await rpc("discovery_settings", [false, null]);
assert.equal((await sql("SELECT count(*)::int n FROM public.discovery_live_cities WHERE user_id=$1", [cai])).rows[0].n, 0);
await rpc("discovery_settings", [true, null]);
check("v2: live city expires, turns off in one call, and is deleted when the member hides");
await db.exec("SET ROLE authenticated");
await as(dee);
await fails(() => sql("INSERT INTO public.discovery_live_cities(user_id,city_key,expires_at) VALUES($1,'miami|fl',now()+interval '1 year')", [dee]), /permission denied/);
await fails(() => sql("UPDATE public.discovery_live_cities SET expires_at=now()+interval '1 year'"), /permission denied/);
await fails(() => sql("SELECT public.discovery_hidden($1)", [ben]), /permission denied/);
assert.equal((await sql("SELECT count(*)::int n FROM public.discovery_live_cities")).rows[0].n, 0);
await db.exec("RESET ROLE");
await db.exec("SET ROLE anon");
await fails(() => sql("SELECT public.discovery_globe()"), /permission denied/);
await fails(() => sql("SELECT public.discovery_live_city('miami|fl',1)"), /permission denied/);
await db.exec("RESET ROLE");
check("v2: clients cannot write live cities, read others' rows, call helpers, or use discovery signed out");
await sql("INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [dee, ana]);
assert.equal(await seen(ana, dee), undefined);
assert.equal(await seen(dee, ana), undefined);
await sql("UPDATE public.profiles SET is_suspended=true WHERE user_id=$1", [eli]);
assert.equal(await seen(ana, eli), undefined);
await sql("UPDATE public.profiles SET is_suspended=false WHERE user_id=$1", [eli]);
check("v2: blocked (both directions) and suspended members stay off the globe");
await as(eli);
const miami = await rpc("creative_trip_action", ["create", null, { title: "Miami week", city_key: "miami|fl", city_label: "Miami, FL", starts_on: "2099-11-19", ends_on: "2099-11-23", capacity: 4 }]);
assert.deepEqual((await seen(ana, eli)).trip, { city_key: "miami|fl", city_label: "Miami, FL", starts_on: "2099-11-19", ends_on: "2099-11-23" });
await sql("UPDATE public.creative_trips SET status='booked' WHERE id=$1", [miami.id]);
assert.equal((await seen(ana, eli)).trip, null);
await sql("INSERT INTO public.creative_trip_members(trip_id,user_id) VALUES($1,$2)", [miami.id, ana]);
assert.equal((await seen(ana, eli)).trip.city_key, "miami|fl");
await sql("UPDATE public.creative_trips SET status='cancelled' WHERE id=$1", [miami.id]);
assert.equal((await seen(ana, eli)).trip, null);
check("v2: travel badges show only trips the viewer could already see, and never cancelled ones");
await as(ana);
assert.equal((await rpc("creative_swipe", [eli, true])).matched, false);
await as(eli);
assert.equal((await rpc("creative_swipe", [ana, true])).matched, true);
assert.equal((await seen(ana, eli)).liked, true);
check("v2: default-visible members can match without opting in first");
// Connect + Match notices (20261114160000).
await db.exec(`CREATE TABLE IF NOT EXISTS public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,type text NOT NULL,title text NOT NULL,body text,data jsonb DEFAULT '{}',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS public.ether_schema_migrations(version text PRIMARY KEY);`);
await db.exec(await readFile("supabase/migrations/20261114160000_connect_match_notices.sql", "utf8"));
await sql("INSERT INTO public.ether_schema_migrations VALUES('20261114160000_connect_match_notices.sql')");
const notices = async () => (await sql("SELECT user_id,type,title,body,data FROM public.notifications ORDER BY body")).rows;
await as(ben);
await rpc("discovery_settings", [true, null]);
assert.equal((await rpc("creative_swipe", [cai, true])).matched, false);
assert.equal((await notices()).length, 0);
await as(cai);
const matchNow = await rpc("creative_swipe", [ben, true]);
assert.equal(matchNow.matched, true);
const sent = await notices();
assert.deepEqual(sent.map((n) => [n.user_id, n.type, n.title, n.body]).sort(), [
  [ben, "match", "It's a match", "You and V2 2 connected. Say hello."],
  [cai, "match", "It's a match", "You and V2 1 connected. Say hello."],
].sort());
assert.ok(sent.every((n) => n.data.conversation_id === matchNow.conversation_id));
await rpc("creative_swipe", [ben, true]);
assert.equal((await notices()).length, 2);
check("connect: a new mutual connect notifies both people once; repeats stay quiet");
await rpc("creative_unmatch", [ben]);
await as(ben);
await rpc("creative_swipe", [cai, true]);
await as(cai);
assert.equal((await rpc("creative_swipe", [ben, true])).matched, true);
assert.equal((await notices()).length, 4);
check("connect: a renewed match after unmatch notifies again");
await as(dee);
await sql("DELETE FROM public.user_blocks WHERE blocker_id=$1", [dee]);
await rpc("discovery_settings", [false, null]);
await fails(() => rpc("creative_swipe", [ana, true]), /Show yourself in discovery to connect/);
check("connect: copy says connect, not like");
await db.exec(await readFile("supabase/rollbacks/20261114160000_connect_match_notices.down.sql", "utf8"));
await fails(() => rpc("creative_swipe", [ana, true]), /Show yourself in discovery to like/);
assert.equal((await sql("SELECT count(*)::int n FROM public.ether_schema_migrations")).rows[0].n, 0);
check("connect: rollback restores the previous creative_swipe");
// Deck order (20261114161000): incoming connects lean to the top, nothing reveals them.
await db.exec(await readFile("supabase/migrations/20261114161000_deck_incoming_first.sql", "utf8"));
await sql("INSERT INTO public.ether_schema_migrations VALUES('20261114161000_deck_incoming_first.sql')");
const pool = Array.from({ length: 24 }, (_, i) => `00000000-0000-4000-a000-${String(i).padStart(12, "0")}`);
const viewer = pool[0];
for (const [i, id] of pool.entries()) {
  await sql("INSERT INTO auth.users VALUES($1)", [id]);
  await sql("INSERT INTO public.profiles(user_id,display_name,city,city_key) VALUES($1,$2,'Denver, CO','denver|co')", [id, `Deck ${i}`]);
}
const fans = pool.slice(1, 6);
for (const fan of fans) {
  await as(fan);
  await rpc("creative_swipe", [viewer, true]);
}
await as(pool[6]);
await rpc("creative_swipe", [viewer, true]);
await sql("INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [viewer, pool[6]]);
await as(pool[7]);
await rpc("creative_swipe", [viewer, true]);
await rpc("discovery_settings", [false, null]);
await as(viewer);
const deckRows = (await rpc("discovery_globe")).filter((r) => pool.includes(r.user_id));
assert.equal(deckRows.some((r) => r.user_id === pool[6] || r.user_id === pool[7]), false);
assert.ok(deckRows.every((r) => Number.isInteger(r.deck)));
assert.deepEqual(Object.keys(deckRows[0]).sort(), ["deck", "liked", "live_city_key", "live_until", "trip", "user_id"]);
const avg = (rows) => rows.reduce((n, r) => n + r.deck, 0) / rows.length;
const fanRows = deckRows.filter((r) => fans.includes(r.user_id));
const rest = deckRows.filter((r) => r.user_id !== viewer && !fans.includes(r.user_id));
assert.equal(fanRows.length, 5);
assert.ok(avg(fanRows) < avg(rest));
assert.ok(Math.max(...fanRows.map((r) => r.deck)) < Math.max(...rest.map((r) => r.deck)));
check("deck: people who connected with me lean to the top; blocked and hidden fans stay out; no field names them");
await as(pool[1]);
assert.equal((await rpc("discovery_globe")).find((r) => r.user_id === viewer).liked, true);
await as(pool[2]);
assert.equal((await rpc("discovery_globe")).find((r) => r.user_id === pool[1]).liked, null);
check("deck: one-sided connects stay private to the person who sent them");
await db.exec(await readFile("supabase/rollbacks/20261114161000_deck_incoming_first.down.sql", "utf8"));
await as(viewer);
assert.equal("deck" in (await rpc("discovery_globe"))[0], false);
check("deck: rollback restores the previous discovery_globe");
// Message requests (20261114170000).
await db.exec(await readFile("supabase/migrations/20261114170000_message_requests.sql", "utf8"));
await sql("INSERT INTO public.ether_schema_migrations VALUES('20261114170000_message_requests.sql')");
const reqUsers = Array.from({ length: 4 }, (_, i) => `00000000-0000-4000-c000-00000000000${i + 1}`);
const [rx, ry, rz, rw] = reqUsers;
for (const [i, id] of reqUsers.entries()) {
  await sql("INSERT INTO auth.users VALUES($1)", [id]);
  await sql("INSERT INTO public.profiles(user_id,display_name,city,city_key) VALUES($1,$2,'Austin, TX','austin|tx')", [id, `Req ${i}`]);
}
const notes = async (who) => (await sql("SELECT count(*)::int n FROM public.notifications WHERE user_id=$1", [who])).rows[0].n;
const before = await notes(ry);
await as(rx);
assert.equal((await rpc("send_message_request", [ry, "Love your lighting work. Collab on a shoot?"])).status, "sent");
assert.equal((await rpc("send_message_request", [ry, "Edited: love your lighting. Shoot next week?"])).status, "sent");
assert.equal(await notes(ry), before);
await as(ry);
let inbox = await rpc("message_request_inbox");
assert.equal(inbox.incoming.length, 1);
assert.equal(inbox.incoming[0].body, "Edited: love your lighting. Shoot next week?");
assert.equal(inbox.incoming[0].display_name, "Req 0");
await as(rz);
assert.equal((await rpc("message_request_inbox")).incoming.length, 0);
check("requests: a note to a non-match waits quietly in their Requests, editable, no notification, private to the two");
await db.exec("SET ROLE authenticated");
await as(rx);
await fails(() => sql("INSERT INTO public.message_requests(sender_id,recipient_id,body) VALUES($1,$2,'x')", [rx, rz]), /permission denied/);
await fails(() => sql("UPDATE public.message_requests SET status='delivered'"), /permission denied/);
await as(rz);
assert.equal((await sql("SELECT count(*)::int n FROM public.message_requests")).rows[0].n, 0);
await db.exec("RESET ROLE");
await as(rx);
await fails(() => rpc("send_message_request", [rx, "me"]), /another creative/);
await fails(() => rpc("send_message_request", [ry, "   "]), /1 to 500/);
await fails(() => rpc("send_message_request", [ry, "x".repeat(501)]), /1 to 500/);
check("requests: no direct writes or reads of others' rows; empty, long and self requests are refused");
await as(ry);
await rpc("creative_swipe", [rx, true]);
await as(rx);
const reqMatch = await rpc("creative_swipe", [ry, true]);
assert.equal(reqMatch.matched, true);
const firstMsgs = (await sql("SELECT sender_id,content FROM public.messages WHERE conversation_id=$1", [reqMatch.conversation_id])).rows;
assert.deepEqual(firstMsgs, [{ sender_id: rx, content: "Edited: love your lighting. Shoot next week?" }]);
await as(ry);
assert.equal((await rpc("message_request_inbox")).incoming.length, 0);
await as(rx);
assert.deepEqual(await rpc("send_message_request", [ry, "hi again"]), { status: "matched", conversation_id: reqMatch.conversation_id });
check("requests: matching moves the note into the new chat as its first message; after that, Message opens the chat");
await as(rz);
await rpc("send_message_request", [rw, "Hello"]);
await as(rw);
const wid = (await rpc("message_request_inbox")).incoming[0].id;
await rpc("ignore_message_request", [wid]);
assert.equal((await rpc("message_request_inbox")).incoming.length, 0);
await as(rz);
assert.equal((await rpc("message_request_inbox")).outgoing.length, 1);
await rpc("send_message_request", [rw, "Hello again"]);
await as(rw);
assert.equal((await rpc("message_request_inbox")).incoming.length, 0);
await fails(() => rpc("ignore_message_request", [wid]), /not found/);
check("requests: ignoring is silent and sticks, even if the sender writes again");
await as(rw);
await rpc("send_message_request", [rx, "Hi"]);
await sql("INSERT INTO public.user_blocks VALUES($1,$2)", [rx, rw]);
assert.equal((await sql("SELECT count(*)::int n FROM public.message_requests WHERE sender_id=$1 AND recipient_id=$2", [rw, rx])).rows[0].n, 0);
await fails(() => rpc("send_message_request", [rx, "Hi"]), /unavailable/);
await sql("DELETE FROM public.user_blocks WHERE blocker_id=$1", [rx]);
check("requests: blocking deletes them both ways and stops new ones");
await db.exec(await readFile("supabase/rollbacks/20261114170000_message_requests.down.sql", "utf8"));
assert.equal((await sql("SELECT to_regclass('public.message_requests') r")).rows[0].r, null);
check("requests: rollback removes the table, functions and triggers");
await db.close();
console.log(`${checks} database checks passed`);
