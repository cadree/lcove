// Item invites on a throwaway Postgres (PGlite): who may invite, to what,
// blocks and bans, one invite per person per item, the invitee's notice,
// accept/decline, the invite card in the two people's chat, picking a role
// and landing in the project chat, tickets and RSVPs for events, RLS, and the
// rollback. Chat, match, block and project-chat rules are prod's own.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addUser, as, inviteDb, ROLLBACK } from "./item-invites-fixture.mjs";

const { db, migration } = await inviteDb();
// The chat rules come from prod. A project's main chat appears on the first
// accepted member (the fixture inserts two accepted members below).
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
assert.equal(accepted.path, `/project/${myProject}?invite=${sent.id}`);
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
assert.deepEqual(back.map((n) => n.title), ["Rezza accepted your invite to Night Shoot"]);
assert.equal(back[0].data.answer, true);
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

// ---- Invite cards in the direct chat ----
const card = async (invite) => (await q("SELECT public.item_invite_card($1) c", [invite]))[0].c;
const apply = async (invite, role, msg = null) => (await q("SELECT public.item_invite_apply($1,$2,$3) r", [invite, role, msg]))[0].r;
const msgs = async (conv) => q("SELECT sender_id, content, shared_invite_id FROM public.messages WHERE conversation_id=$1 ORDER BY created_at", [conv]);
const inviteRow = async (inviteId) => { await db.exec("RESET ROLE"); return one("SELECT * FROM public.item_invites WHERE id=$1", [inviteId]); };

const projInvite = await inviteRow(sent.id);
assert.ok(projInvite.conversation_id && projInvite.message_id);
assert.equal((await one("SELECT type FROM public.conversations WHERE id=$1", [projInvite.conversation_id])).type, "direct");
for (const who of [CADRE, REZZA]) {
  await as(db, "authenticated", who);
  const thread = await msgs(projInvite.conversation_id);
  assert.equal(thread[0].shared_invite_id, sent.id);
  assert.equal(thread[0].sender_id, CADRE);
  assert.equal(thread[0].content, "Invited you to Night Shoot");
}
await as(db, "authenticated", REZZA);
const evInvite = await inviteRow(evSent.id);
assert.equal(evInvite.conversation_id, projInvite.conversation_id);
ok("each invite lands as a card from the sender in the one direct chat between the two, which both can read");

await as(db, "authenticated", STRANGER);
assert.equal((await msgs(projInvite.conversation_id)).length, 0);
await assert.rejects(card(sent.id), /not found/);
ok("no one else can read the card or its details");

await as(db, "authenticated", CADRE);
const senderView = await card(sent.id);
assert.equal(senderView.viewer, "sender");
await as(db, "authenticated", REZZA);
const before = await card(evSent.id);
assert.equal(before.viewer, "invitee");
assert.equal(before.title, "Gallery night");
assert.equal(before.place, "The Mint, Charlotte");
assert.equal(before.stage, "declined");
ok("the card shows the item, who is looking, and where the invite stands");

for (const who of [REZZA, CADRE]) {
  await as(db, "authenticated", who);
  await assert.rejects(q("INSERT INTO public.messages(conversation_id,sender_id,content,shared_invite_id) VALUES($1,$2,'fake',$3)", [projInvite.conversation_id, who, sent.id]), /sent by the app/);
}
await as(db, "authenticated", REZZA);
const plain = (await one("INSERT INTO public.messages(conversation_id,sender_id,content) VALUES($1,$2,'hey') RETURNING id", [projInvite.conversation_id, REZZA])).id;
await assert.rejects(q("UPDATE public.messages SET shared_invite_id=$1 WHERE id=$2", [sent.id, plain]), /sent by the app/);
await assert.rejects(q("SELECT public.post_item_invite_card($1,'x')", [sent.id]), /permission denied/);
ok("people cannot forge or attach invite cards; only the invite RPC posts them");

// ---- Accepting a project invite: role picker, then the project chat ----
const thread = await msgs(projInvite.conversation_id);
assert.ok(thread.some((m) => m.sender_id === REZZA && m.content === "Accepted your invite to Night Shoot. Picking a role now."));
assert.equal((await card(sent.id)).stage, "accepted");
ok("accepting posts her line under the card, and the card reads accepted");

await db.exec("RESET ROLE");
const photo = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Photographer',1) RETURNING id", [myProject])).id;
const fullRole = (await one("INSERT INTO project_roles(project_id,role_name,slots_available,slots_filled) VALUES($1,'Gaffer',1,1) RETURNING id", [myProject])).id;
const otherRole = (await one("INSERT INTO project_roles(project_id,role_name) VALUES($1,'Stylist') RETURNING id", [hostGig])).id;
await as(db, "authenticated", REZZA);
await assert.rejects(apply(sent.id, fullRole), /full/);
await assert.rejects(apply(sent.id, otherRole), /Pick a role on this project/);
ok("she can only pick an open role on that project");

const joined = await apply(sent.id, photo, "Got a 85mm");
assert.equal(joined.status, "accepted");
assert.ok(joined.chat_id);
const mainChat = joined.chat_id;
const member = await one("SELECT role::text, project_role_name FROM public.conversation_participants WHERE conversation_id=$1 AND user_id=$2", [mainChat, REZZA]);
assert.deepEqual(member, { role: "member", project_role_name: "Photographer" });
const chatLines = await msgs(mainChat);
assert.ok(chatLines.some((m) => m.sender_id === CADRE && m.content === "🎉 Rezza joined the project as Photographer"));
await db.exec("RESET ROLE");
assert.equal((await one("SELECT slots_filled FROM project_roles WHERE id=$1", [photo])).slots_filled, 1);
assert.equal((await one("SELECT count(*)::int n FROM conversations WHERE project_id=$1 AND type='group'", [myProject])).n, 1);
await as(db, "authenticated", REZZA);
assert.deepEqual([(await card(sent.id)).stage, (await card(sent.id)).role_name], ["joined", "Photographer"]);
assert.equal((await apply(sent.id, photo)).already, true);
await as(db, "authenticated", CADRE);
assert.ok((await q("SELECT title FROM notifications WHERE type='item_invite'")).some((n) => n.title === "Rezza joined Night Shoot"));
ok("an owner's invite is the owner's yes: picking a role puts her on the project and in its main chat with a join line");

await as(db, "authenticated", REZZA);
const gigInvite = (await q("SELECT id FROM public.item_invites WHERE item_id=$1", [hostGig]))[0].id;
assert.equal((await respond(gigInvite, true)).path, `/project/${hostGig}?invite=${gigInvite}`);
const pending = await apply(gigInvite, otherRole);
assert.equal(pending.status, "pending");
assert.equal(pending.chat_id, null);
assert.deepEqual([(await card(gigInvite)).stage, (await card(gigInvite)).role_name], ["applied", "Stylist"]);
ok("an invite from someone who is not the owner is a normal application the owner still reviews");

await as(db, "authenticated", HOST);
await q("UPDATE public.project_applications SET status='accepted', reviewed_by=$1 WHERE id=$2", [HOST, pending.application_id]);
const gigChat = (await one("SELECT id FROM public.conversations WHERE project_id=$1 AND type='group'", [hostGig])).id;
assert.deepEqual((await q("SELECT user_id, role::text FROM public.conversation_participants WHERE conversation_id=$1 ORDER BY role::text DESC", [gigChat])).map((r) => [r.user_id, r.role]),
  [[HOST, "owner"], [REZZA, "member"]]);
assert.ok((await msgs(gigChat)).some((m) => m.content === "🎉 Rezza joined the project as Stylist"));
await as(db, "authenticated", REZZA);
assert.equal((await card(gigInvite)).stage, "joined");
ok("when the owner accepts in review, the database adds her to the project chat (creating it the first time)");

// ---- Events: accept is not going; tickets or an RSVP are ----
await db.exec("RESET ROLE");
const freeEvent = (await one("INSERT INTO events(creator_id,title,city,start_date) VALUES($1,'Studio night','Charlotte',$2) RETURNING id", [CADRE, later])).id;
const paidEvent = (await one("INSERT INTO events(creator_id,title,city,start_date) VALUES($1,'Ticketed show','Charlotte',$2) RETURNING id", [CADRE, later])).id;
await db.query("INSERT INTO ticket_tiers(event_id,name,price_cents) VALUES($1,'GA',2500)", [paidEvent]);
await as(db, "authenticated", CADRE);
const freeInv = (await send("event", freeEvent, REZZA)).id;
const paidInv = (await send("event", paidEvent, REZZA)).id;
await as(db, "authenticated", REZZA);
const freeAns = await respond(freeInv, true);
assert.equal(freeAns.path, `/event/${freeEvent}?invite=${freeInv}`);
const paidAns = await respond(paidInv, true);
assert.equal(paidAns.path, `/event/${paidEvent}/tickets`);
assert.equal((await card(freeInv)).stage, "accepted");
assert.equal((await card(paidInv)).stage, "accepted");
assert.equal((await card(paidInv)).ticket_required, true);
assert.equal((await card(freeInv)).ticket_required, false);
assert.equal((await q("SELECT 1 FROM public.event_rsvps WHERE user_id=$1 AND event_id IN ($2,$3)", [REZZA, freeEvent, paidEvent])).length, 0);
const lines = (await msgs(projInvite.conversation_id)).map((m) => m.content);
assert.ok(lines.includes("Accepted your invite to Studio night. RSVPing now."));
assert.ok(lines.includes("Accepted your invite to Ticketed show. Getting a ticket now."));
ok("accepting an event invite sends her to RSVP (free) or tickets (paid) and does not count as going");

await q("INSERT INTO public.event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')", [freeEvent, REZZA]);
assert.equal((await card(freeInv)).stage, "going");
await db.exec("RESET ROLE");
await db.query("INSERT INTO event_attendees(event_id,attendee_user_id,status) VALUES($1,$2,'cancelled')", [paidEvent, REZZA]);
await as(db, "authenticated", REZZA);
assert.equal((await card(paidInv)).stage, "accepted");
await db.exec("RESET ROLE");
await db.query("INSERT INTO event_attendees(event_id,attendee_user_id,status) VALUES($1,$2,'registered')", [paidEvent, REZZA]);
await as(db, "authenticated", CADRE);
assert.equal((await card(paidInv)).stage, "going");
ok("the card says going only after a real RSVP or a live ticket");

// ---- Match-only DMs, unsend, blocks ----
const MATCHY = id(10);
await db.exec("RESET ROLE");
await addUser(db, MATCHY, "Ivy", "charlotte|nc");
await db.query("INSERT INTO discovery_preferences(user_id,matches_only) VALUES($1,true)", [MATCHY]);
await as(db, "authenticated", CADRE);
const gated = await send("event", freeEvent, MATCHY);
assert.equal(gated.notified, true);
assert.equal(gated.conversation_id, null);
await db.exec("RESET ROLE");
assert.equal((await one("SELECT count(*)::int n FROM conversation_participants WHERE user_id=$1", [MATCHY])).n, 0);
await db.query("INSERT INTO creative_matches(first_id,second_id) VALUES(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid))", [CADRE, MATCHY]);
await as(db, "authenticated", CADRE);
assert.ok((await send("event", paidEvent, MATCHY)).conversation_id);
ok("someone who takes DMs from matches only still gets the notice, and the card once they match");

assert.ok(muted.conversation_id);
ok("muting invite notices does not stop the chat card");

await as(db, "authenticated", CADRE);
await q("UPDATE public.messages SET deleted_at=now() WHERE id=$1", [projInvite.message_id]);
await as(db, "authenticated", REZZA);
const gone = await one("SELECT content, shared_invite_id FROM public.messages WHERE id=$1", [projInvite.message_id]);
assert.deepEqual(gone, { content: null, shared_invite_id: null });
ok("unsending the card clears it for both");

await db.exec("RESET ROLE");
await db.query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [REZZA, CADRE]);
await as(db, "authenticated", CADRE);
await assert.rejects(card(freeInv), /not found/);
await db.exec("RESET ROLE");
await db.query("DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", [REZZA, CADRE]);
ok("after a block neither side can open the card");

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
assert.equal((await q("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='messages' AND column_name='shared_invite_id'"))[0].n, 0);
assert.equal((await q("SELECT count(*)::int n FROM pg_trigger WHERE tgname IN ('guard_invite_card','add_accepted_member_to_project_chat')"))[0].n, 0);
assert.ok(!(await q("SELECT prosrc FROM pg_proc WHERE proname='enforce_project_conversation'"))[0].prosrc.includes("ether.project_chat_for"));
assert.ok((await q("SELECT count(*)::int n FROM public.messages"))[0].n > 5);
ok("rollback drops only the invite table, card column, triggers and functions, and restores prod's project-chat rule");
console.log(`item invites db: ${checks} checks passed`);
