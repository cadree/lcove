// Creative bridge on a throwaway Postgres (PGlite) with prod's block, discovery,
// project-visibility, report and moderation rules: credits on finished work,
// "open to" tags, wrap-up vouches and open calls. Each check runs as a signed-in
// user under RLS. Ends by rolling every migration back, re-applying them, and
// checking a second apply is harmless.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addUser, as, bridgeDb, has, MIGRATIONS, ROLLBACKS } from "./creative-bridge-fixture.mjs";

const { db, migrations } = await bridgeDb();
// Applying twice must be harmless (an apply file may be re-run after a partial failure).
for (const sql of migrations) await db.exec(sql);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CADRE = id(1), REZZA = id(2), THEO = id(3), JADE = id(4), BANNED = id(5), BLOCKER = id(6), STRANGER = id(7), TOKYO = id(8), HIDDEN = id(9), ADMIN = id(10);
await addUser(db, CADRE, "Cadre", "charlotte|nc");
await addUser(db, REZZA, "Rezza", "charlotte|nc");
await addUser(db, THEO, "Theo", "charlotte|nc");
await addUser(db, JADE, "Jade", "charlotte");
await addUser(db, BANNED, "Banned", "charlotte|nc", { access_status: "banned" });
await addUser(db, BLOCKER, "Blocker", "charlotte|nc");
await addUser(db, STRANGER, "Sol", "charlotte|nc");
await addUser(db, TOKYO, "Ren", "tokyo|jp");
await addUser(db, HIDDEN, "Quiet", "charlotte|nc");
await addUser(db, ADMIN, "Admin", "charlotte|nc");
await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [ADMIN]);
await db.query("INSERT INTO discovery_preferences(user_id,discoverable) VALUES($1,false)", [HIDDEN]);
await db.query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [BLOCKER, CADRE]);

const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const all = async (sql, args) => (await db.query(sql, args)).rows;
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const asUser = async (who, fn) => { await as(db, "authenticated", who); try { return await fn(); } finally { await db.exec("RESET ROLE"); } };
const rpc = (who, sql, args) => asUser(who, async () => (await one(sql, args)).r);
const fails = async (who, sql, args, pattern, msg) => {
  await as(db, "authenticated", who);
  try {
    await db.query(sql, args);
    assert.fail(`${msg}: expected an error`);
  } catch (e) {
    if (e.code === "ERR_ASSERTION") throw e;
    assert.match(e.message, pattern, msg);
    checks++;
  } finally {
    await db.exec("RESET ROLE");
  }
};

// ---------------------------------------------------------------- fixtures
const project = (await one("INSERT INTO projects(creator_id,title,status,cover_image_url) VALUES($1,'Night Shoot','in_progress','https://x/c.jpg') RETURNING id", [CADRE])).id;
const photo = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Photographer',1) RETURNING id", [project])).id;
const stylist = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Stylist',2) RETURNING id", [project])).id;
const apply = async (proj, role, who, status = "accepted") =>
  db.query("INSERT INTO project_applications(project_id,role_id,applicant_id,status) VALUES($1,$2,$3,$4)", [proj, role, who, status]);
await apply(project, photo, REZZA);
await apply(project, stylist, REZZA);
await apply(project, stylist, THEO);
await apply(project, stylist, STRANGER, "pending");
await apply(project, stylist, BLOCKER);
const privateProject = (await one("INSERT INTO projects(creator_id,title,status,is_private) VALUES($1,'Private one','in_progress',true) RETURNING id", [JADE])).id;
const privRole = (await one("INSERT INTO project_roles(project_id,role_name) VALUES($1,'Editor') RETURNING id", [privateProject])).id;
await apply(privateProject, privRole, THEO);

// ======================================================= 1. credits
{
  // Nothing before completion.
  eq((await one("SELECT count(*)::int n FROM work_credits")).n, 0, "no credits before the project completes");
  await asUser(CADRE, () => db.query("UPDATE projects SET status='completed' WHERE id=$1", [project]));
  const credits = await all("SELECT user_id, role, status, credited_by FROM work_credits WHERE project_id=$1 ORDER BY role", [project]);
  const byUser = Object.fromEntries(credits.map((c) => [c.user_id, c]));
  eq(byUser[CADRE]?.role, "Project lead", "the owner is credited as project lead");
  eq(byUser[CADRE]?.status, "accepted", "the owner's own credit is accepted");
  eq(byUser[REZZA]?.role, "Photographer · Stylist", "two accepted roles are joined");
  eq(byUser[REZZA]?.status, "pending", "member credits start pending (consent)");
  eq(byUser[THEO]?.role, "Stylist", "accepted role name becomes the credit");
  ok(!byUser[STRANGER], "a pending applicant is not credited");
  ok(!byUser[BLOCKER], "a member who blocked the owner is not credited");
  const notes = await all("SELECT user_id, type, data FROM notifications WHERE type='credit' ORDER BY user_id");
  eq(notes.map((n) => n.user_id).sort(), [REZZA, THEO].sort(), "each credited member gets one notice, the owner none");
  eq(notes[0].data.path, "/profile?section=credits", "the notice opens the credits section");

  // Re-completing does not duplicate.
  await asUser(CADRE, () => db.query("UPDATE projects SET status='in_progress' WHERE id=$1", [project]));
  await asUser(CADRE, () => db.query("UPDATE projects SET status='completed' WHERE id=$1", [project]));
  eq((await one("SELECT count(*)::int n FROM work_credits WHERE project_id=$1", [project])).n, 3, "re-completing adds no duplicates");
  eq((await one("SELECT count(*)::int n FROM notifications WHERE type='credit'")).n, 2, "re-completing sends no new notices");

  // Visibility: pending credits are private to the credited person and the creditor.
  const seen = async (who, target) => (await rpc(who, "SELECT public.profile_credits($1) r", [target])).map((c) => c.status);
  eq(await seen(REZZA, REZZA), ["pending"], "Rezza sees her pending credit");
  eq(await seen(STRANGER, REZZA), [], "others don't see a pending credit");
  eq((await seen(CADRE, REZZA)), ["pending"], "the creditor sees who they credited");
  const rezzaCredit = (await one("SELECT id FROM work_credits WHERE user_id=$1", [REZZA])).id;
  await fails(THEO, "SELECT public.respond_work_credit($1,true)", [rezzaCredit], /Credit not found/, "only the credited person can accept");
  eq(await rpc(REZZA, "SELECT public.respond_work_credit($1,true) r", [rezzaCredit]), "accepted", "Rezza accepts");
  ok((await one("SELECT read_at FROM notifications WHERE user_id=$1 AND type='credit'", [REZZA])).read_at, "answering marks the notice read");
  eq(await seen(STRANGER, REZZA), ["accepted"], "an accepted credit shows to members");
  const shown = (await rpc(STRANGER, "SELECT public.profile_credits($1) r", [REZZA]))[0];
  eq([shown.title, shown.source, shown.role, shown.cover], ["Night Shoot", "project", "Photographer · Stylist", "https://x/c.jpg"], "credit card fields");
  eq(await seen(BLOCKER, CADRE), [], "a blocked viewer doesn't see the owner's credits");
  eq(await rpc(REZZA, "SELECT public.respond_work_credit($1,false) r", [rezzaCredit]), "hidden", "Rezza hides it");
  eq(await seen(STRANGER, REZZA), [], "a hidden credit disappears for others");
  eq(await seen(CADRE, REZZA), [], "and for the creditor");
  eq(await seen(REZZA, REZZA), ["hidden"], "but stays visible to Rezza so she can show it again");
  await rpc(REZZA, "SELECT public.respond_work_credit($1,true) r", [rezzaCredit]);
  await asUser(REZZA, () => fails(REZZA, "UPDATE work_credits SET status='accepted'", [], /permission denied/, "no direct writes"));
  await fails(REZZA, "INSERT INTO work_credits(user_id,credited_by,project_id,role) VALUES($1,$1,$2,'x')", [REZZA, project], /permission denied/, "no direct inserts");

  // Private project: credits only show to its members.
  await asUser(JADE, () => db.query("UPDATE projects SET status='completed' WHERE id=$1", [privateProject]));
  const theoPriv = (await one("SELECT id FROM work_credits WHERE user_id=$1 AND project_id=$2", [THEO, privateProject])).id;
  await rpc(THEO, "SELECT public.respond_work_credit($1,true) r", [theoPriv]);
  const theoSeenBy = async (who) => (await rpc(who, "SELECT public.profile_credits($1) r", [THEO])).map((c) => c.title).sort();
  eq(await theoSeenBy(STRANGER), [], "a private project's credit is hidden from non-members (Theo's Night Shoot credit is still pending)");
  eq(await theoSeenBy(JADE), ["Private one"], "the private project's owner sees it");

  // Post credits.
  const post = (await one("INSERT INTO posts(user_id,content,media_type,media_url) VALUES($1,'Lookbook day one','photo','https://x/p.jpg') RETURNING id", [CADRE])).id;
  const credited = await rpc(CADRE, "SELECT public.credit_post($1,$2,$3) r", [post, THEO, "  Stylist  "]);
  eq([credited.status, credited.role, credited.created], ["pending", "Stylist", true], "post author credits Theo");
  eq((await rpc(CADRE, "SELECT public.credit_post($1,$2,$3) r", [post, THEO, "Wardrobe"])).role, "Wardrobe", "re-crediting while pending changes the role");
  eq((await one("SELECT count(*)::int n FROM notifications WHERE user_id=$1 AND type='credit' AND data->>'credit_id'=$2", [THEO, credited.id])).n, 1, "one notice per post credit");
  await fails(REZZA, "SELECT public.credit_post($1,$2,'Stylist')", [post, THEO], /own posts/, "only the author credits on a post");
  await fails(CADRE, "SELECT public.credit_post($1,$2,'Stylist')", [post, CADRE], /someone else/, "no self credit");
  await fails(CADRE, "SELECT public.credit_post($1,$2,'Stylist')", [post, BLOCKER], /can't credit/, "no credit across a block");
  await fails(CADRE, "SELECT public.credit_post($1,$2,'Stylist')", [post, BANNED], /can't credit/, "no credit to a banned account");
  await fails(CADRE, "SELECT public.credit_post($1,$2,'')", [post, REZZA], /60 characters/, "a role is required");
  await fails(CADRE, "SELECT public.credit_post($1,$2,$3)", [post, REZZA, "x".repeat(61)], /60 characters/, "roles are short");
  await fails(CADRE, "SELECT public.credit_post($1,$2,'porn')", [post, REZZA], /isn't allowed/, "objectionable roles are refused");
  eq((await rpc(STRANGER, "SELECT public.post_credits($1) r", [post])).length, 0, "pending post credits are private");
  eq((await rpc(CADRE, "SELECT public.post_credits($1) r", [post])).map((c) => c.role), ["Wardrobe"], "the author sees the credit");
  await rpc(THEO, "SELECT public.respond_work_credit($1,true) r", [credited.id]);
  eq((await rpc(STRANGER, "SELECT public.post_credits($1) r", [post])).map((c) => c.name), ["Theo"], "accepted post credit is public");
  await fails(THEO, "SELECT public.remove_post_credit($1)", [credited.id], /author/, "the credited person can't delete it (they hide it)");
  const rezzaPost = await rpc(CADRE, "SELECT public.credit_post($1,$2,'Light') r", [post, REZZA]);
  await rpc(CADRE, "SELECT public.remove_post_credit($1) r", [rezzaPost.id]);
  eq((await one("SELECT count(*)::int n FROM work_credits WHERE id=$1", [rezzaPost.id])).n, 0, "the author removes a credit");
  // A removed post hides its credits.
  await db.query("UPDATE posts SET removed_at=now() WHERE id=$1", [post]);
  eq((await rpc(STRANGER, "SELECT public.profile_credits($1) r", [THEO])).filter((c) => c.source === "post").length, 0, "a removed post's credit stops showing");
  await db.query("UPDATE posts SET removed_at=NULL WHERE id=$1", [post]);
}

// ======================================================= 2. open to
if (has("open_to")) {
  const today = new Date().toISOString().slice(0, 10);
  const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const saved = await rpc(REZZA, "SELECT public.set_open_to($1,$2) r", [["shoots", "paid_gigs", "shoots"], inDays(10)]);
  eq(saved.tags, ["paid_gigs", "shoots"], "tags are de-duplicated and sorted");
  eq(saved.last_day, inDays(10), "an end date is the last day");
  await fails(REZZA, "SELECT public.set_open_to($1,NULL)", [["shoots", "nudes"]], /Pick from the list/, "only preset tags");
  await fails(REZZA, "SELECT public.set_open_to($1,$2)", [["shoots"], inDays(-1)], /next 6 months/, "no past end date");
  await fails(REZZA, "SELECT public.set_open_to($1,$2)", [["shoots"], inDays(200)], /next 6 months/, "no end date past 6 months");
  const visible = async (who) => (await asUser(who, () => all("SELECT user_id FROM profile_open_to ORDER BY user_id"))).map((r) => r.user_id);
  ok((await visible(STRANGER)).includes(REZZA), "members see current tags");
  await rpc(CADRE, "SELECT public.set_open_to($1,NULL) r", [["collabs"]]);
  ok(!(await visible(BLOCKER)).includes(CADRE), "a blocked pair doesn't see each other's tags");
  // Expiry: an end date in the past, and 90 days without a date.
  await db.query("UPDATE profile_open_to SET until=$2 WHERE user_id=$1", [REZZA, inDays(-1)]);
  ok(!(await visible(STRANGER)).includes(REZZA), "tags stop showing after the end date");
  ok((await visible(REZZA)).includes(REZZA), "the owner still sees expired tags to renew them");
  await db.query("UPDATE profile_open_to SET updated_at=now() - interval '91 days' WHERE user_id=$1", [CADRE]);
  ok(!(await visible(STRANGER)).includes(CADRE), "tags without an end date expire after 90 days");
  await db.query("UPDATE profile_open_to SET updated_at=now() - interval '89 days' WHERE user_id=$1", [CADRE]);
  ok((await visible(STRANGER)).includes(CADRE), "and still show at 89 days");
  await rpc(BANNED, "SELECT 1 r", []);
  await db.query("INSERT INTO profile_open_to(user_id,tags) VALUES($1,'{shoots}')", [BANNED]);
  ok(!(await visible(STRANGER)).includes(BANNED), "a banned account's tags don't show");
  await fails(BANNED, "SELECT public.set_open_to($1,NULL)", [["shoots"]], /not allowed/, "a banned account can't save tags");
  eq((await rpc(REZZA, "SELECT public.set_open_to($1,NULL) r", [[]])).tags, [], "an empty list clears");
  ok(!(await visible(REZZA)).includes(REZZA), "cleared");
  await fails(REZZA, "INSERT INTO profile_open_to(user_id,tags) VALUES($1,'{shoots}')", [REZZA], /permission denied/, "no direct writes");
  await rpc(REZZA, "SELECT public.set_open_to($1,$2) r", [["shoots", "paid_gigs"], today]);
  ok((await visible(STRANGER)).includes(REZZA), "an end date of today still shows today");
}

// ======================================================= 3. vouches
if (has("project_vouches")) {
  const vouch = (who, subject, note = null, proj = project) => rpc(who, "SELECT public.vouch_for($1,$2,$3) r", [proj, subject, note]);
  const open = (await one("INSERT INTO projects(creator_id,title,status) VALUES($1,'Still going','in_progress') RETURNING id", [CADRE])).id;
  const openRole = (await one("INSERT INTO project_roles(project_id,role_name) VALUES($1,'MUA') RETURNING id", [open])).id;
  await apply(open, openRole, REZZA);
  await fails(CADRE, "SELECT public.vouch_for($1,$2,NULL)", [open, REZZA], /marked complete/, "no vouches before completion");
  const v = await vouch(CADRE, REZZA, "  Calm on set,   sharp eye. ");
  eq(v.note, "Calm on set, sharp eye.", "the owner vouches with a cleaned note");
  await vouch(REZZA, CADRE);
  await vouch(THEO, REZZA, "Brought extra lights.");
  await fails(CADRE, "SELECT public.vouch_for($1,$2,NULL)", [project, REZZA], /already vouched/, "one vouch per pair per project");
  await fails(STRANGER, "SELECT public.vouch_for($1,$2,NULL)", [project, REZZA], /worked on this project/, "a pending applicant can't vouch");
  await fails(CADRE, "SELECT public.vouch_for($1,$2,NULL)", [project, STRANGER], /didn't work on this project/, "can't vouch for a non-member");
  await fails(CADRE, "SELECT public.vouch_for($1,$2,NULL)", [project, CADRE], /teammate/, "no self vouch");
  await fails(CADRE, "SELECT public.vouch_for($1,$2,NULL)", [project, BLOCKER], /can't vouch/, "no vouch across a block (even for an accepted member)");
  await fails(THEO, "SELECT public.vouch_for($1,$2,$3)", [project, CADRE, "x".repeat(281)], /280/, "short notes");
  await fails(THEO, "SELECT public.vouch_for($1,$2,'what a slut')", [project, CADRE], /isn't allowed/, "objectionable notes are refused");
  await fails(THEO, "INSERT INTO project_vouches(project_id,author_id,subject_id) VALUES($1,$2,$3)", [project, THEO, CADRE], /permission denied/, "no direct inserts");
  const notice = await one("SELECT body, data FROM notifications WHERE type='vouch' AND user_id=$1 ORDER BY created_at LIMIT 1", [REZZA]);
  eq(notice.body, "Cadre vouched for you on Night Shoot: showed up and delivered.", "the vouched person is notified");
  const profile = await rpc(STRANGER, "SELECT public.profile_vouches($1) r", [REZZA]);
  eq(profile.count, 2, "Rezza has two vouches");
  eq(profile.items.map((i) => i.author_name).sort(), ["Cadre", "Theo"], "with their authors");
  eq(profile.items.find((i) => i.author_name === "Cadre").project_title, "Night Shoot", "and the project");
  eq((await rpc(BLOCKER, "SELECT public.profile_vouches($1) r", [REZZA])).count, 1, "a viewer blocked with an author doesn't see that author's vouch");
  // Wrap-up team list.
  const wrap = await rpc(CADRE, "SELECT public.project_wrap_up($1) r", [project]);
  eq([wrap.member, wrap.completed], [true, true], "the owner is a member of the completed project");
  eq(wrap.team.map((t) => [t.name, t.role, t.vouched]), [["Rezza", "Photographer · Stylist", true], ["Theo", "Stylist", false]], "team with roles and my vouches (blocked member left out)");
  const outsider = await rpc(STRANGER, "SELECT public.project_wrap_up($1) r", [project]);
  eq([outsider.member, outsider.team.length], [false, 0], "non-members get no team list");
  // Reports and moderation.
  const vouchId = (await one("SELECT id FROM project_vouches WHERE author_id=$1 AND subject_id=$2", [THEO, REZZA])).id;
  await asUser(REZZA, () => db.query("INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,'vouch',$2,'Harassment or abuse')", [REZZA, vouchId]));
  eq((await one("SELECT count(*)::int n FROM content_reports WHERE target_type='vouch'")).n, 1, "a vouch can be reported through the existing flow");
  await db.query("SELECT public.admin_apply_report_target('vouch',$1,'hide','test',NULL)", [vouchId]);
  eq((await rpc(STRANGER, "SELECT public.profile_vouches($1) r", [REZZA])).count, 1, "an admin-hidden vouch stops showing");
  eq((await rpc(REZZA, "SELECT public.profile_vouches($1) r", [REZZA])).count, 1, "including to its subject");
  await db.query("SELECT public.admin_apply_report_target('vouch',$1,'unhide','test',NULL)", [vouchId]);
  eq((await rpc(STRANGER, "SELECT public.profile_vouches($1) r", [REZZA])).count, 2, "unhide restores it");
  // Deletion: author only.
  await asUser(REZZA, () => db.query("DELETE FROM project_vouches WHERE id=$1", [vouchId]));
  eq((await one("SELECT count(*)::int n FROM project_vouches WHERE id=$1", [vouchId])).n, 1, "the subject can't delete a vouch");
  await asUser(THEO, () => db.query("DELETE FROM project_vouches WHERE id=$1", [vouchId]));
  eq((await one("SELECT count(*)::int n FROM project_vouches WHERE id=$1", [vouchId])).n, 0, "the author deletes their vouch");
  await db.query("SELECT public.admin_apply_report_target('post',$1,'hide','x',NULL)", [id(999)]).catch(() => undefined);
}

// ======================================================= 4. open calls
if (has("open_calls")) {
  const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const shoot = (await one("INSERT INTO projects(creator_id,title,status,venue) VALUES($1,'Rooftop editorial','open','221B Secret St') RETURNING id", [JADE])).id;
  const post = (who, args) => rpc(who, "SELECT public.post_open_call($1,$2,$3,$4,$5,$6,$7,$8) r", args);
  const call = await post(JADE, [shoot, null, "MUA", inDays(5), "charlotte|nc", "Charlotte, NC", true, "Two looks, golden hour."]);
  ok(call.id && call.role_id, "the owner posts a call for a new role");
  eq(call.listed, true, "a discoverable owner's call is listed");
  eq((await one("SELECT role_name, slots_available FROM project_roles WHERE id=$1", [call.role_id])), { role_name: "MUA", slots_available: 1 }, "the new role is a normal project role");
  await fails(REZZA, "SELECT public.post_open_call($1,NULL,'MUA',$2,'charlotte|nc','Charlotte',false,NULL)", [shoot, inDays(3)], /Only the project owner/, "only the owner posts calls");
  await fails(JADE, "SELECT public.post_open_call($1,$2,NULL,$3,'charlotte|nc','Charlotte',false,NULL)", [shoot, call.role_id, inDays(3)], /already has an open call/, "one open call per role");
  await fails(JADE, "SELECT public.post_open_call($1,NULL,'DP',$2,'charlotte|nc','Charlotte',false,NULL)", [shoot, inDays(-1)], /next 12 months/, "no past dates");
  await fails(JADE, "SELECT public.post_open_call($1,NULL,'DP',$2,'Not|A|City','x',false,NULL)", [shoot, inDays(2)], /Choose a city/, "a city is required");
  await fails(JADE, "SELECT public.post_open_call($1,NULL,'DP',$2,'charlotte|nc','Charlotte',false,$3)", [shoot, inDays(2), "x".repeat(281)], /280/, "short descriptions");
  await fails(JADE, "SELECT public.post_open_call($1,$2,NULL,$3,'charlotte|nc','Charlotte',false,NULL)", [privateProject, privRole, inDays(2)], /Open the project|Private/, "no calls on a private or closed project");
  const near = async (who, key = "charlotte|nc") => rpc(who, "SELECT public.open_calls_near($1) r", [key]);
  const seen = await near(REZZA);
  eq(seen.map((c) => [c.role, c.project_title, c.city_label, c.paid, c.applied]), [["MUA", "Rooftop editorial", "Charlotte, NC", true, false]], "Rezza sees the call in Charlotte");
  ok(!JSON.stringify(seen).includes("221B"), "a call never carries the venue or an address");
  eq((await near(REZZA, "charlotte")).length, 1, "a city key without the state still matches");
  eq((await near(TOKYO, "tokyo|jp")).length, 0, "Tokyo doesn't see Charlotte's calls");
  eq((await near(JADE)).length, 0, "the owner doesn't see their own call in Explore");
  await db.query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [THEO, JADE]);
  eq((await near(THEO)).length, 0, "a blocked pair doesn't see each other's calls");
  await db.query("DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", [THEO, JADE]);
  // Applying is the existing application flow.
  await asUser(REZZA, () => db.query("INSERT INTO project_applications(project_id,role_id,applicant_id,status) VALUES($1,$2,$3,'pending')", [shoot, call.role_id, REZZA]));
  eq((await near(REZZA))[0].applied, true, "her application shows as applied");
  eq((await asUser(STRANGER, () => all("SELECT id FROM project_open_calls WHERE project_id=$1", [shoot]))).length, 1, "the call shows on the public project");
  // Filled closes it.
  await asUser(JADE, () => db.query("UPDATE project_applications SET status='accepted' WHERE role_id=$1 AND applicant_id=$2", [call.role_id, REZZA]));
  eq((await near(STRANGER)).length, 0, "a filled role's call closes");
  // Past date closes it.
  const later = await post(JADE, [shoot, null, "Gaffer", inDays(1), "charlotte|nc", "Charlotte", false, null]);
  eq((await near(STRANGER)).length, 1, "a second call shows");
  await db.query("UPDATE project_open_calls SET call_date=$2 WHERE id=$1", [later.id, inDays(-1)]);
  eq((await near(STRANGER)).length, 0, "a call stops showing after its date");
  // Owner closes it; a hidden owner isn't listed in Explore.
  const third = await post(JADE, [shoot, null, "Driver", inDays(4), "charlotte|nc", "Charlotte", false, null]);
  await fails(REZZA, "SELECT public.close_open_call($1)", [third.id], /Only the project owner/, "only the owner closes a call");
  await rpc(JADE, "SELECT public.close_open_call($1) r", [third.id]);
  eq((await near(STRANGER)).length, 0, "a closed call stops showing");
  const quiet = (await one("INSERT INTO projects(creator_id,title,status) VALUES($1,'Quiet shoot','open') RETURNING id", [HIDDEN])).id;
  const quietCall = await post(HIDDEN, [quiet, null, "Assistant", inDays(3), "charlotte|nc", "Charlotte", false, null]);
  eq(quietCall.listed, false, "a hidden owner is told the call isn't listed");
  eq((await near(STRANGER)).length, 0, "a call from someone hidden from discovery stays off Explore");
  eq((await asUser(STRANGER, () => all("SELECT id FROM project_open_calls WHERE project_id=$1", [quiet]))).length, 1, "but shows on the project");
  // Project completed or made private closes calls.
  const fourth = await post(JADE, [shoot, null, "Runner", inDays(4), "charlotte|nc", "Charlotte", false, null]);
  eq((await near(STRANGER)).length, 1, "fourth call live");
  await asUser(JADE, () => db.query("UPDATE projects SET is_private=true WHERE id=$1", [shoot]));
  eq((await near(STRANGER)).length, 0, "a project made private drops its calls");
  ok(fourth.id, "fourth posted");
  await fails(STRANGER, "INSERT INTO project_open_calls(project_id,role_id,created_by,city_key,city_label,call_date) VALUES($1,$2,$3,'charlotte','C',now()::date)", [shoot, call.role_id, STRANGER], /permission denied/, "no direct inserts");
}

// ======================================================= rollback and re-apply
{
  const OBJECTS = {
    work_credits: { table: "work_credits", fns: ["credit_post", "respond_work_credit", "profile_credits", "creative_account_ok", "is_project_member"] },
    open_to: { table: "profile_open_to", fns: ["set_open_to", "open_to_last_day"] },
    project_vouches: { table: "project_vouches", fns: ["vouch_for", "project_wrap_up", "profile_vouches"] },
    open_calls: { table: "project_open_calls", fns: ["post_open_call", "close_open_call", "open_calls_near", "open_call_live"] },
  };
  const present = Object.entries(OBJECTS).filter(([name]) => has(name)).map(([, o]) => o);
  await db.exec("RESET ROLE");
  for (const file of [...ROLLBACKS].reverse()) await db.exec(await readFile(file, "utf8"));
  for (const o of present) eq((await one("SELECT to_regclass($1) r", [`public.${o.table}`])).r, null, `rollback drops ${o.table}`);
  const fns = await all("SELECT proname FROM pg_proc WHERE proname = ANY($1)", [present.flatMap((o) => o.fns)]);
  eq(fns, [], "rollback drops every function");
  eq((await one("SELECT count(*)::int n FROM pg_trigger WHERE tgname='credit_completed_project'")).n, 0, "rollback drops the project trigger");
  if (has("project_vouches")) {
    const def = (await one("SELECT pg_get_functiondef('public.admin_apply_report_target'::regproc) d")).d;
    ok(!def.includes("vouch"), "rollback restores prod's admin_apply_report_target");
    eq((await one("SELECT count(*)::int n FROM content_reports WHERE target_type='vouch'")).n, 1, "reports on vouches survive the rollback");
    await assert.rejects(db.query("INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,'vouch',$1,'Spam')", [CADRE]), /check constraint/);
    checks++;
    await db.exec("DELETE FROM content_reports WHERE target_type='vouch'");
  }
  // Re-apply on top of rolled-back data, then once more.
  for (const file of MIGRATIONS) await db.exec(await readFile(file, "utf8"));
  for (const file of MIGRATIONS) await db.exec(await readFile(file, "utf8"));
  for (const o of present) ok((await one("SELECT to_regclass($1) r", [`public.${o.table}`])).r, `re-apply recreates ${o.table}`);
  const reCredit = await rpc(CADRE, "SELECT public.credit_post((SELECT id FROM posts LIMIT 1),$1,'Stylist') r", [REZZA]);
  eq(reCredit.created, true, "features work after re-apply");
}

console.log(`creative bridge db: ${checks} checks passed`);
