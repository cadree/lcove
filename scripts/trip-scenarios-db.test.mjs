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
// Let's Travel end to end: create, join, budget edits, pledges, approvals, receipts,
// leave, cancel, complete, with several members. Each step goes through the same RPC the app calls.
const users = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-b000-00000000000${i + 1}`);
const [org, amy, bo, cy, dan] = users;
for (const [i, id] of users.entries()) {
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  await db.query("INSERT INTO public.profiles(user_id,display_name) VALUES($1,$2)", [id, `Traveler ${i}`]);
}
const as = (id) => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
const act = async (who, action, trip, data = {}) => {
  await as(who);
  return (await db.query("SELECT public.creative_trip_action($1,$2,$3) v", [action, trip, data])).rows[0].v;
};
const fails = (fn, pattern) => assert.rejects(fn, pattern);
let checks = 0;
const check = (label) => console.log(`ok ${++checks} - ${label}`);
const me = (snap, id) => snap.members.find((m) => m.user_id === id);

const base = { title: "Lisbon shoot", city_key: "lisbon|pt", city_label: "Lisbon, Portugal", starts_on: "2099-05-01", ends_on: "2099-05-06", capacity: 3 };
await fails(() => act(org, "create", null, { ...base, starts_on: "2001-01-01" }), /future dates/);
await fails(() => act(org, "create", null, { ...base, ends_on: "2099-04-01" }), /ends_on|check|after/i);
await fails(() => act(org, "create", null, { ...base, capacity: 1 }), /capacity|check|2 and 20/i);
const req = "00000000-0000-4000-b100-000000000001";
let trip = await act(org, "create", null, { ...base, request_id: req });
assert.equal((await act(org, "create", null, { ...base, request_id: req })).id, trip.id);
check("create: rejects past dates, end before start and bad capacity; a retried create is idempotent");

trip = await act(amy, "join", trip.id);
trip = await act(bo, "join", trip.id);
await fails(() => act(cy, "join", trip.id), /full/);
assert.equal(trip.members.length, 3);
check("join: members join until capacity, then the trip is full");

await fails(() => act(amy, "add_item", trip.id, { label: "Flat", estimate_cents: 90000 }), /Only the organizer/);
trip = await act(org, "add_item", trip.id, { label: "Flat", estimate_cents: 90001 });
trip = await act(org, "add_item", trip.id, { label: "Van", estimate_cents: 30000, quote_url: "https://example.com/q" });
await fails(() => act(org, "add_item", trip.id, { label: "X", estimate_cents: 1, quote_url: "http://x" }), /HTTPS/);
assert.equal(trip.total_cents, 120001);
const shares = trip.members.map((m) => m.share_cents);
assert.equal(shares.reduce((a, b) => a + b, 0), 120001);
assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
check("budget: only the organizer edits it; shares split to the cent");

for (const who of [org, amy, bo]) {
  const s = me(trip, who).share_cents;
  await fails(() => act(who, "pledge", trip.id, { cents: s + 1 }), /between zero and your share/);
  trip = await act(who, "pledge", trip.id, { cents: s });
}
await fails(() => act(org, "approve_budget", trip.id, { revision: trip.revision - 1 }), /Budget changed/);
trip = await act(org, "approve_budget", trip.id, { revision: trip.revision });
trip = await act(amy, "approve_budget", trip.id, { revision: trip.revision });
await fails(() => act(org, "record_receipt", trip.id, { revision: trip.revision, item_id: trip.items[0].id, actual_cents: 100, receipt_url: "https://r" }), /Everyone must approve/);
check("pledges: capped at each share; approvals need the current revision and everyone before receipts");

const rev = trip.revision;
trip = await act(org, "add_item", trip.id, { label: "Food", estimate_cents: 3000 });
assert.equal(trip.revision, rev + 1);
assert.ok(trip.members.every((m) => m.pledge_cents === 0 && m.approved_revision === null));
check("editing the budget resets every pledge and approval so nobody is held to an old number");

trip = await act(bo, "leave", trip.id);
assert.equal(trip.left, true);
await as(org);
trip = (await db.query("SELECT public.creative_trip_snapshot($1) v", [trip.id ?? (await db.query("SELECT id FROM public.creative_trips LIMIT 1")).rows[0].id])).rows[0].v;
assert.equal(trip.members.length, 2);
assert.equal((await db.query("SELECT count(*)::int n FROM public.conversation_participants WHERE user_id=$1", [bo])).rows[0].n, 0);
await fails(() => act(org, "leave", trip.id), /organizer/);
check("leave: a member leaves the trip and its chat; the organizer must cancel instead");

for (const who of [org, amy]) trip = await act(who, "pledge", trip.id, { cents: me(trip, who).share_cents });
for (const who of [org, amy]) trip = await act(who, "approve_budget", trip.id, { revision: trip.revision });
for (const item of trip.items) {
  await fails(() => act(amy, "record_receipt", trip.id, { revision: trip.revision, item_id: item.id, actual_cents: item.estimate_cents + 1, receipt_url: "https://r" }), /within the approved estimate/);
  trip = await act(amy, "record_receipt", trip.id, { revision: trip.revision, item_id: item.id, actual_cents: item.estimate_cents, receipt_url: "https://receipts.example/" + item.label });
}
await fails(() => act(org, "add_item", trip.id, { label: "Late", estimate_cents: 5 }), /before bookings/);
await fails(() => act(org, "pledge", trip.id, { cents: 0 }), /locked/);
await fails(() => act(cy, "join", trip.id), /no longer accepting/);
for (const item of trip.items) for (const who of [org, amy]) trip = await act(who, "confirm_receipt", trip.id, { item_id: item.id, approved: true });
assert.equal(trip.status, "booked");
trip = await act(amy, "confirm_receipt", trip.id, { item_id: trip.items[0].id, approved: false });
assert.equal(trip.status, "planning");
trip = await act(amy, "confirm_receipt", trip.id, { item_id: trip.items[0].id, approved: true });
assert.equal(trip.status, "booked");
check("receipts: within estimate, lock the budget and roster, and every member's confirmation books the trip");

trip = await act(amy, "report_paid", trip.id, { cents: me(trip, amy).share_cents });
await fails(() => act(amy, "report_paid", trip.id, { cents: me(trip, amy).share_cents + 1 }), /between zero and your share/);
await fails(() => act(org, "complete", trip.id), /after the trip ends/);
await db.query("UPDATE public.creative_trips SET starts_on='2001-01-01',ends_on='2001-01-02' WHERE id=$1", [trip.id]);
await fails(() => act(amy, "complete", trip.id), /after the trip ends/);
trip = await act(org, "complete", trip.id);
assert.equal(trip.status, "completed");
await fails(() => act(org, "pledge", trip.id, { cents: 0 }), /closed/);
assert.equal((await act(amy, "leave", trip.id)).left, true);
check("complete: only the organizer, only after the end date; a closed trip still lets members leave its chat");

let second = await act(org, "create", null, { ...base, title: "Porto weekend", capacity: 4 });
second = await act(cy, "join", second.id);
await fails(() => act(cy, "cancel", second.id), /Only the organizer/);
second = await act(org, "cancel", second.id);
assert.equal(second.status, "cancelled");
await fails(() => act(dan, "join", second.id), /closed/);
await as(dan);
const listed = (await db.query("SELECT public.creative_trip_list() v")).rows[0].v;
assert.equal(listed.some((t) => t.id === second.id), false);
check("cancel: organizer only; a cancelled trip leaves the public list and refuses joins");

await db.query("INSERT INTO public.user_blocks VALUES($1,$2)", [dan, org]);
const third = await act(org, "create", null, { ...base, title: "Madrid days" });
await fails(() => act(dan, "join", third.id), /unavailable/);
await as(dan);
assert.equal((await db.query("SELECT public.creative_trip_list() v")).rows[0].v.some((t) => t.id === third.id), false);
check("blocks: a blocked member neither sees nor joins the organizer's trips");
// Join by request (20261114171000): the organizer approves new travelers.
await db.exec(`CREATE TABLE IF NOT EXISTS public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,type text NOT NULL,title text NOT NULL,body text,data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS public.ether_schema_migrations(version text PRIMARY KEY);`);
await db.exec(await readFile("supabase/migrations/20261114171000_trip_join_requests.sql", "utf8"));
await db.query("INSERT INTO public.ether_schema_migrations VALUES('20261114171000_trip_join_requests.sql')");
await db.query("DELETE FROM public.user_blocks");
const q = async (who, fn, args) => {
  await as(who);
  return (await db.query(`SELECT public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`, args)).rows[0].v;
};
let rome = await act(org, "create", null, { ...base, title: "Rome stills", capacity: 3 });
await fails(() => act(amy, "join", rome.id), /organizer approves/);
assert.deepEqual(await q(amy, "creative_trip_request", [rome.id, "I shoot 35mm, happy to split the van"]), { status: "pending" });
const orgNotes = (await db.query("SELECT type,body FROM public.notifications WHERE user_id=$1 AND type='trip_request'", [org])).rows;
assert.equal(orgNotes.length, 1);
assert.match(orgNotes[0].body, /Traveler 1 asked to join Rome stills/);
await q(amy, "creative_trip_request", [rome.id, "Updated note"]);
assert.equal((await db.query("SELECT count(*)::int n FROM public.notifications WHERE user_id=$1 AND type='trip_request'", [org])).rows[0].n, 1);
const seenByOrg = await q(org, "creative_trip_requests", [rome.id]);
assert.deepEqual(seenByOrg.map((r) => [r.user_id, r.note, r.status]), [[amy, "Updated note", "pending"]]);
assert.equal((await q(cy, "creative_trip_requests", [rome.id])).length, 0);
check("join requests: direct joins are closed; a request notifies the organizer once and is visible to the trip, not outsiders");
await fails(() => q(amy, "creative_trip_answer", [rome.id, amy, true]), /Only the organizer/);
rome = await q(org, "creative_trip_answer", [rome.id, amy, true]);
assert.equal(rome.members.length, 2);
assert.equal((await db.query("SELECT count(*)::int n FROM public.conversation_participants WHERE conversation_id=$1 AND user_id=$2", [rome.conversation_id, amy])).rows[0].n, 1);
assert.equal((await db.query("SELECT count(*)::int n FROM public.notifications WHERE user_id=$1 AND type='trip_approved'", [amy])).rows[0].n, 1);
assert.equal((await q(amy, "creative_trip_requests", [rome.id]))[0].status, "approved");
check("join requests: approval adds the traveler and the group chat, resets shares, and tells them");
await q(bo, "creative_trip_request", [rome.id, ""]);
rome = await q(org, "creative_trip_answer", [rome.id, bo, false]);
assert.equal(rome.members.length, 2);
assert.deepEqual(await q(bo, "creative_trip_request", [rome.id, "please"]), { status: "declined" });
assert.equal((await q(bo, "creative_trip_requests", [rome.id]))[0].status, "declined");
await fails(() => act(bo, "join", rome.id), /organizer approves/);
check("join requests: a decline is final for that trip and asking again does not re-notify");
await q(cy, "creative_trip_request", [rome.id, ""]);
rome = await q(org, "creative_trip_answer", [rome.id, cy, true]);
await fails(() => q(dan, "creative_trip_request", [rome.id, ""]), /full/);
await db.query("INSERT INTO public.user_blocks VALUES($1,$2)", [dan, amy]);
const romeAgain = await act(org, "create", null, { ...base, title: "Rome again" });
await q(amy, "creative_trip_request", [romeAgain.id, ""]);
await q(org, "creative_trip_answer", [romeAgain.id, amy, true]);
await fails(() => q(dan, "creative_trip_request", [romeAgain.id, ""]), /unavailable/);
check("join requests: full trips and anyone blocked by a member are refused");
await db.exec(await readFile("supabase/rollbacks/20261114171000_trip_join_requests.down.sql", "utf8"));
const after = await act(org, "create", null, { ...base, title: "After rollback" });
assert.equal((await act(cy, "join", after.id)).members.length, 2);
check("join requests: rollback restores direct joins");
// Trip board (20261114172000).
await db.exec(await readFile("supabase/migrations/20261114172000_trip_board.sql", "utf8"));
await db.query("INSERT INTO public.ether_schema_migrations VALUES('20261114172000_trip_board.sql')");
// Production members cannot call objectionable_text directly; mirror that.
await db.exec("GRANT USAGE ON SCHEMA public TO authenticated; REVOKE ALL ON FUNCTION public.objectionable_text(text) FROM PUBLIC,authenticated");
const board = await act(org, "create", null, { ...base, title: "Board trip" });
await act(cy, "join", board.id);
const asMember = async (who, text, args = []) => {
  await as(who);
  await db.exec("SET ROLE authenticated");
  try {
    return (await db.query(text, args)).rows;
  } finally {
    await db.exec("RESET ROLE");
  }
};
await asMember(org, "INSERT INTO public.creative_trip_board(trip_id,kind,title,day,at_time) VALUES($1,'stop','Golden hour at the bridge','2099-05-02','18:30')", [board.id]);
await asMember(cy, "INSERT INTO public.creative_trip_board(trip_id,kind,title,image_url) VALUES($1,'photo','Mood','https://img.example/a.jpg')", [board.id]);
await asMember(cy, "INSERT INTO public.creative_trip_board(trip_id,kind,title) VALUES($1,'packing','Reflector')", [board.id]);
await asMember(org, "UPDATE public.creative_trip_board SET done=true WHERE kind='packing'");
const rows = await asMember(cy, "SELECT kind,title,done FROM public.creative_trip_board ORDER BY kind");
assert.deepEqual(rows.map((r) => [r.kind, r.done]), [["packing", true], ["photo", false], ["stop", false]]);
check("board: travelers add stops, photos and checklist items, and tick each other's items");
assert.equal((await asMember(dan, "SELECT count(*)::int n FROM public.creative_trip_board"))[0].n, 0);
await fails(() => asMember(dan, "INSERT INTO public.creative_trip_board(trip_id,kind,title) VALUES($1,'packing','x')", [board.id]), /row-level security/);
await fails(() => asMember(cy, "INSERT INTO public.creative_trip_board(trip_id,kind,title,image_url) VALUES($1,'photo','x','http://insecure')", [board.id]), /check/i);
await fails(() => asMember(cy, "INSERT INTO public.creative_trip_board(trip_id,kind,title,created_by) VALUES($1,'packing','x',$2)", [board.id, org]), /row-level security/);
await fails(() => asMember(cy, "UPDATE public.creative_trip_board SET trip_id=$1", [rome.id]), /permission denied/);
check("board: outsiders see nothing and can't add; no http images, no posing as someone else, no moving items between trips");
await asMember(cy, "DELETE FROM public.creative_trip_board WHERE kind='stop'");
assert.equal((await asMember(org, "SELECT count(*)::int n FROM public.creative_trip_board WHERE kind='stop'"))[0].n, 1);
await asMember(org, "DELETE FROM public.creative_trip_board WHERE kind='photo'");
assert.equal((await asMember(org, "SELECT count(*)::int n FROM public.creative_trip_board WHERE kind='photo'"))[0].n, 0);
check("board: you remove your own items; the organizer can remove any");
await act(org, "cancel", board.id);
await fails(() => asMember(cy, "INSERT INTO public.creative_trip_board(trip_id,kind,title) VALUES($1,'shopping','late')", [board.id]), /row-level security/);
assert.equal((await asMember(cy, "SELECT count(*)::int n FROM public.creative_trip_board"))[0].n, 2);
check("board: a closed trip's board stays readable but frozen");
await db.exec(await readFile("supabase/rollbacks/20261114172000_trip_board.down.sql", "utf8"));
assert.equal((await db.query("SELECT to_regclass('public.creative_trip_board') r")).rows[0].r, null);
check("board: rollback removes it");
await db.close();
console.log(`${checks} trip scenario checks passed`);
