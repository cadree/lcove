// Item invites on a throwaway Postgres (PGlite): who may invite, to what,
// blocks and bans, one invite per person per item, the invitee's notice,
// accept/decline, RLS on the table, and the rollback.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addUser, as, inviteDb, ROLLBACK } from "./item-invites-fixture.mjs";

const { db, migration } = await inviteDb();
// Applying twice must be harmless (the apply file may be re-run after a partial failure).
await db.exec(migration);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CADRE = id(1), REZZA = id(2), HOST = id(3), MEMBER = id(4), BANNED = id(5), SUSP = id(6), BLOCKER = id(7), TOKYO = id(8), STRANGER = id(9);
await addUser(db, CADRE, "Cadre", "charlotte|nc");
await addUser(db, REZZA, "Rezza", "charlotte|nc");
await addUser(db, HOST, "Jade", "Charlotte, NC");
await addUser(db, MEMBER, "Theo", "charlotte|nc");
await addUser(db, BANNED, "Banned", "charlotte|nc", { access_status: "banned" });
await addUser(db, SUSP, "Suspended", "charlotte|nc", { is_suspended: true });
await addUser(db, BLOCKER, "Blocker", "charlotte|nc");
await addUser(db, TOKYO, "Ren", "tokyo|jp");
await addUser(db, STRANGER, "Sol", "charlotte|nc");
const day = 86_400_000;
const later = new Date(Date.now() + 5 * day).toISOString();
const past = new Date(Date.now() - 5 * day).toISOString();
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const myProject = (await one("INSERT INTO projects(creator_id,title,venue) VALUES($1,'Night Shoot','NoDa') RETURNING id", [CADRE])).id;
const myDraft = (await one("INSERT INTO projects(creator_id,title,status) VALUES($1,'Draft idea','draft') RETURNING id", [CADRE])).id;
const myPrivate = (await one("INSERT INTO projects(creator_id,title,is_private) VALUES($1,'Private','true') RETURNING id", [CADRE])).id;
const hostGig = (await one("INSERT INTO projects(creator_id,title,listing_type) VALUES($1,'Lookbook gig','gig') RETURNING id", [HOST])).id;
const hostBusy = (await one("INSERT INTO projects(creator_id,title,status) VALUES($1,'Already shooting','in_progress') RETURNING id", [HOST])).id;
const tokyoProject = (await one("INSERT INTO projects(creator_id,title) VALUES($1,'Shibuya walk') RETURNING id", [TOKYO])).id;
await db.query("INSERT INTO project_applications(project_id,applicant_id,status) VALUES($1,$2,'accepted')", [myProject, MEMBER]);
await db.query("INSERT INTO project_applications(project_id,applicant_id,status) VALUES($1,$2,'accepted')", [hostBusy, CADRE]);
const myEvent = (await one("INSERT INTO events(creator_id,title,venue,city,start_date) VALUES($1,'Gallery night','The Mint','Charlotte',$2) RETURNING id", [CADRE, later])).id;
const pastEvent = (await one("INSERT INTO events(creator_id,title,city,start_date) VALUES($1,'Last month','Charlotte',$2) RETURNING id", [CADRE, past])).id;
const hostEvent = (await one("INSERT INTO events(creator_id,title,city,start_date) VALUES($1,'Rooftop set','Charlotte',$2) RETURNING id", [HOST, later])).id;
const lockedEvent = (await one("INSERT INTO events(creator_id,title,city,start_date,password_protected) VALUES($1,'Secret','Charlotte',$2,true) RETURNING id", [HOST, later])).id;
const draftEvent = (await one("INSERT INTO events(creator_id,title,city,start_date,status) VALUES($1,'Not yet','Charlotte',$2,'draft') RETURNING id", [HOST, later])).id;
await db.query("INSERT INTO event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')", [myEvent, MEMBER]);
await db.query("INSERT INTO event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')", [hostEvent, REZZA]);

let checks = 0;
const ok = (label) => console.log(`ok ${++checks} - ${label}`);
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const targets = async (invitee, kind) => (await q("SELECT public.item_invite_targets($1,$2) t", [invitee, kind]))[0].t;
const send = async (kind, item, invitee) => (await q("SELECT public.send_item_invite($1,$2,$3) r", [kind, item, invitee]))[0].r;
const respond = async (invite, accept) => (await q("SELECT public.respond_item_invite($1,$2) r", [invite, accept]))[0].r;

await as(db, "authenticated", CADRE);
const projects = await targets(REZZA, "project");
assert.deepEqual(projects.map((r) => [r.title, r.section, r.role, r.state]), [
  ["Already shooting", "yours", "member", "available"],
  ["Night Shoot", "yours", "host", "available"],
  ["Lookbook gig", "nearby", null, "available"],
]);
ok("project picker: yours (host and member) first, then open listings in my city; no drafts, private, in-progress-only listings or other cities");
const events = await targets(REZZA, "event");
assert.deepEqual(events.map((r) => [r.title, r.section, r.state, r.place]), [
  ["Gallery night", "yours", "available", "The Mint, Charlotte"],
  ["Rooftop set", "nearby", "available", "Charlotte"],
]);
assert.ok(!events.some((r) => [pastEvent, lockedEvent, draftEvent].includes(r.item_id)));
ok("event picker: my upcoming event, then public upcoming events nearby; no past, draft or password events");
assert.equal((await targets(MEMBER, "project")).find((r) => r.item_id === myProject).state, "member");
assert.equal((await targets(MEMBER, "event")).find((r) => r.item_id === myEvent).state, "going");
assert.equal((await targets(HOST, "project")).find((r) => r.item_id === hostGig).state, "host");
ok("rows I host show the invitee as already a member or going; their own item shows as theirs");
assert.equal((await targets(REZZA, "event")).find((r) => r.item_id === hostEvent).state, "available");
ok("someone else's RSVP to a listed event stays private");

const sent = await send("project", myProject, REZZA);
assert.equal(sent.status, "sent");
assert.equal(sent.notified, true);
ok("owner invites to a project");
const again = await send("project", myProject, REZZA);
assert.equal(again.status, "already_invited");
assert.equal(again.id, sent.id);
assert.equal((await targets(REZZA, "project")).find((r) => r.item_id === myProject).state, "invited");
ok("a second tap is the same invite and the row now shows invited");
assert.equal((await send("project", myProject, MEMBER)).status, "already_in");
assert.equal((await send("event", myEvent, MEMBER)).status, "already_in");
ok("cannot invite someone already on my project or going to my event");
const evSent = await send("event", myEvent, REZZA);
assert.equal(evSent.status, "sent");
ok("host invites to an event");
const listed = await send("event", hostEvent, REZZA);
assert.equal(listed.status, "sent");
assert.equal(listed.notified, false);
ok("inviting to a listed event she already RSVP'd to looks sent but sends no notice");
assert.equal((await send("project", hostGig, REZZA)).status, "sent");
ok("anyone can invite to a listed open gig nearby");
await assert.rejects(send("project", myDraft, REZZA), /cannot invite/);
await assert.rejects(send("project", myPrivate, REZZA), /cannot invite/);
await assert.rejects(send("event", pastEvent, REZZA), /cannot invite/);
await assert.rejects(send("event", lockedEvent, REZZA), /cannot invite/);
await assert.rejects(send("event", draftEvent, REZZA), /cannot invite/);
await assert.rejects(send("project", id(999), REZZA), /cannot invite/);
ok("drafts, private, past, password, unpublished or unknown items are refused");
await assert.rejects(send("project", myProject, CADRE), /someone else/);
await assert.rejects(send("project", myProject, BANNED), /unavailable/);
await assert.rejects(send("project", myProject, SUSP), /unavailable/);
await assert.rejects(targets(BANNED, "project"), /unavailable/);
ok("cannot invite yourself, banned or suspended people");

await db.exec("RESET ROLE");
await db.query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [BLOCKER, CADRE]);
await db.query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [HOST, STRANGER]);
await as(db, "authenticated", CADRE);
await assert.rejects(send("project", myProject, BLOCKER), /unavailable/);
await assert.rejects(targets(BLOCKER, "event"), /unavailable/);
await assert.rejects(send("event", hostEvent, STRANGER), /cannot invite/);
assert.ok(!(await targets(STRANGER, "event")).some((r) => r.item_id === hostEvent));
ok("blocks either way stop invites, including to an item whose host blocked the invitee");

await as(db, "authenticated", SUSP);
await assert.rejects(send("project", hostGig, REZZA), /cannot send invites/);
ok("a suspended account cannot send invites");

await as(db, "authenticated", TOKYO);
assert.deepEqual((await targets(REZZA, "project")).map((r) => [r.title, r.section]), [["Shibuya walk", "yours"]]);
ok("someone in another city is not offered Charlotte listings");

await as(db, "authenticated", REZZA);
const notes = await q("SELECT title, body, data FROM public.notifications WHERE type='item_invite' ORDER BY created_at, title");
assert.deepEqual(notes.map((n) => n.title).sort(), ["Cadre invited you to Gallery night", "Cadre invited you to Lookbook gig", "Cadre invited you to Night Shoot"]);
const projNote = notes.find((n) => n.data.item_id === myProject);
assert.equal(projNote.data.path, `/project/${myProject}`);
assert.equal(projNote.data.invite_id, sent.id);
ok("invitee gets '<name> invited you to <title>' with the item's path");
const mine = await q("SELECT recipient_id, status FROM public.item_invites ORDER BY created_at");
assert.ok(mine.length >= 3 && mine.every((r) => r.recipient_id === REZZA));
await assert.rejects(q("INSERT INTO public.item_invites(item_type,item_id,sender_id,recipient_id) VALUES('project',$1,$2,$3)", [myProject, CADRE, REZZA]), /permission denied/);
await assert.rejects(q("UPDATE public.item_invites SET status='accepted'"), /permission denied/);
await assert.rejects(q("DELETE FROM public.item_invites"), /permission denied/);
ok("invitee reads only her invites and cannot write the table directly");
const accepted = await respond(sent.id, true);
assert.equal(accepted.status, "accepted");
assert.equal(accepted.path, `/project/${myProject}`);
assert.equal((await respond(sent.id, false)).status, "accepted");
const answered = await q("SELECT data FROM public.notifications WHERE data->>'invite_id'=$1", [sent.id]);
assert.equal(answered[0].data.accepted, true);
ok("invitee accepts once; answering again keeps the first answer; her notice is marked answered");
assert.equal((await respond(evSent.id, false)).status, "declined");
ok("invitee declines an event invite");

await as(db, "authenticated", STRANGER);
await assert.rejects(respond(evSent.id, true), /not found/);
assert.equal((await q("SELECT 1 FROM public.item_invites")).length, 0);
ok("someone else cannot answer or read the invite");

await as(db, "authenticated", CADRE);
const back = await q("SELECT title, data FROM public.notifications WHERE type='item_invite'");
assert.deepEqual(back.map((n) => n.title), ["Rezza is checking out Night Shoot"]);
assert.equal((await q("SELECT status FROM public.item_invites WHERE id=$1", [evSent.id]))[0].status, "declined");
assert.equal((await send("event", myEvent, REZZA)).status, "already_invited");
ok("sender hears about an accept, not a decline, and cannot re-invite after a decline");

await as(db, "anon");
await assert.rejects(q("SELECT 1 FROM public.item_invites"), /permission denied/);
await assert.rejects(q("SELECT public.send_item_invite('project',$1,$2)", [myProject, REZZA]), /permission denied/);
await assert.rejects(q("SELECT public.item_invite_candidates($1)", [CADRE]), /permission denied/);
ok("signed-out callers cannot read invites or call the RPCs");
await as(db, "authenticated", CADRE);
await assert.rejects(q("SELECT * FROM public.item_invite_candidates($1)", [REZZA]), /permission denied/);
await assert.rejects(q("SELECT public.item_invite_state('event',$1,$2,true,$3)", [hostEvent, HOST, REZZA]), /permission denied/);
ok("helpers that could reveal someone else's RSVPs are not callable by users");

await db.exec("RESET ROLE");
await db.query("INSERT INTO notification_preferences(user_id,project_invites_enabled) VALUES($1,false)", [STRANGER]);
await as(db, "authenticated", CADRE);
const muted = await send("project", myProject, STRANGER);
assert.equal(muted.status, "sent");
assert.equal(muted.notified, false);
ok("invites switched off in settings record the invite without a notice");

await db.exec("RESET ROLE");
const filler = [];
for (let n = 0; n < 40; n++) {
  const pid = (await one("INSERT INTO projects(creator_id,title) VALUES($1,$2) RETURNING id", [MEMBER, `Filler ${n}`])).id;
  filler.push(pid);
}
await as(db, "authenticated", MEMBER);
for (const pid of filler.slice(0, 40)) await send("project", pid, REZZA);
const extra = (await (async () => { await db.exec("RESET ROLE"); return one("INSERT INTO projects(creator_id,title) VALUES($1,'One more') RETURNING id", [MEMBER]); })()).id;
await as(db, "authenticated", MEMBER);
await assert.rejects(send("project", extra, REZZA), /Too many invites/);
ok("a sender is capped at 40 invites an hour");

await db.exec("RESET ROLE");
await db.exec(await readFile(ROLLBACK, "utf8"));
assert.equal((await q("SELECT to_regclass('public.item_invites') r"))[0].r, null);
assert.equal((await q("SELECT count(*)::int n FROM pg_proc WHERE proname LIKE '%item_invite%' OR proname IN ('invite_city_token','invite_account_ok')"))[0].n, 0);
assert.ok((await q("SELECT count(*)::int n FROM public.projects"))[0].n > 40);
ok("rollback drops only the invite table and functions");
console.log(`item invites db: ${checks} checks passed`);
