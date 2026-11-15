// Connect → invite to an existing project/gig or event, at phone size (390x844, touch).
// The app runs against fixture Supabase routes; invite RPCs and notifications run on a
// local PGlite with the real item_invites migration (no network database).
//   ROOT=http://127.0.0.1:8100 OUT=/tmp/invite node scripts/connect-invite-check.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";
import { addUser, as, inviteDb } from "./item-invites-fixture.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8100";
const out = process.env.OUT || "/tmp/invite";
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ME = fixtures.me;
const id = (n) => `00000000-0000-4000-8000-0000000c${String(n).padStart(4, "0")}`;
const REZZA = id(1), JADE = id(2);

const { db } = await inviteDb();
await addUser(db, ME, "Maya Torres", "charlotte|nc");
await addUser(db, REZZA, "Rezza Monet", "charlotte|nc");
await addUser(db, JADE, "Jade Okafor", "Charlotte, NC");
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const all = async (sql, args) => (await db.query(sql, args)).rows;
const at = (days, hour) => { const d = new Date(Date.now() + days * 864e5); d.setUTCHours(hour, 0, 0, 0); return d.toISOString(); };
const day = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const cover = (n) => `https://covers.fixture.test/${n}.svg`;
const nightShoot = (await one("INSERT INTO projects(creator_id,title,venue,timeline_start,cover_image_url) VALUES($1,'Night Shoot','NoDa',$2,$3) RETURNING id", [ME, day(6), cover(0)])).id;
const albumCover = (await one("INSERT INTO projects(creator_id,title,venue,timeline_start) VALUES($1,'Album cover','South End',$2) RETURNING id", [ME, day(12)])).id;
const memberOf = (await one("INSERT INTO projects(creator_id,title,status,venue,cover_image_url) VALUES($1,'Brand campaign','in_progress','Uptown',$2) RETURNING id", [JADE, cover(1)])).id;
const lookbook = (await one("INSERT INTO projects(creator_id,title,listing_type,venue,timeline_start,cover_image_url) VALUES($1,'Lookbook gig','gig','Plaza Midwood',$2,$3) RETURNING id", [JADE, day(9), cover(2)])).id;
await db.query("INSERT INTO project_applications(project_id,applicant_id,status) VALUES($1,$2,'accepted')", [albumCover, REZZA]);
await db.query("INSERT INTO project_applications(project_id,applicant_id,status) VALUES($1,$2,'accepted')", [memberOf, ME]);
const gallery = (await one("INSERT INTO events(creator_id,title,venue,city,start_date,image_url) VALUES($1,'Gallery night','The Mint','Charlotte',$2,$3) RETURNING id", [ME, at(5, 0), cover(3)])).id;
const openHouse = (await one("INSERT INTO events(creator_id,title,venue,city,start_date) VALUES($1,'Studio open house','Camp North End','Charlotte',$2) RETURNING id", [ME, at(8, 18)])).id;
const rooftop = (await one("INSERT INTO events(creator_id,title,venue,city,start_date,image_url) VALUES($1,'Rooftop set','Merchant & Trade','Charlotte',$2,$3) RETURNING id", [JADE, at(3, 1), cover(4)])).id;
const listening = (await one("INSERT INTO events(creator_id,title,venue,city,start_date,image_url) VALUES($1,'Listening party','Snug Harbor','Charlotte',$2,$3) RETURNING id", [REZZA, at(4, 0), cover(5)])).id;
await db.query("INSERT INTO event_rsvps(event_id,user_id,status) VALUES($1,$2,'going')", [openHouse, REZZA]);

const calls = [];
const rpc = async (fn, args) => {
  await as(db, "authenticated", ME);
  try {
    if (fn === "item_invite_targets") return { body: (await one("SELECT public.item_invite_targets($1,$2) r", [args.p_invitee, args.p_kind])).r };
    if (fn === "send_item_invite") return { body: (await one("SELECT public.send_item_invite($1,$2,$3) r", [args.p_kind, args.p_item, args.p_invitee])).r };
    if (fn === "respond_item_invite") return { body: (await one("SELECT public.respond_item_invite($1,$2) r", [args.p_invite, args.p_accept])).r };
  } catch (e) {
    return { status: 400, body: { message: e.message, code: "P0001" } };
  } finally {
    await db.exec("RESET ROLE");
  }
  return null;
};
const handle = (fn) => async (req) => {
  const args = JSON.parse(req.postData() || "{}");
  calls.push({ fn, args });
  return rpc(fn, args);
};
const profile = { id: ME, user_id: ME, display_name: "Maya Torres", avatar_url: null, city: "Charlotte", city_display: "Charlotte, NC", city_key: "charlotte|nc", bio: "", onboarding_completed: true, access_status: "active", created_at: new Date().toISOString() };
const eventRow = async (eid) => {
  const e = await one("SELECT * FROM events WHERE id=$1", [eid]);
  return e && { ...e, description: "An evening of new music.", address: null, state: "NC", country: "US", ticket_type: "free", ticket_price: null, credits_price: null, capacity: null, timezone: "America/New_York", event_type: "in_person", requires_approval: false, waitlist_enabled: false, features: [], slug: null, hide_address: false, created_at: e.start_date, updated_at: e.start_date };
};
const mock = {
  item_invite_targets: handle("item_invite_targets"),
  send_item_invite: handle("send_item_invite"),
  respond_item_invite: handle("respond_item_invite"),
  "send-push-notification": (req) => { calls.push({ fn: "push", args: JSON.parse(req.postData() || "{}") }); return { body: { ok: true } }; },
  "send-notification-email": (req) => { calls.push({ fn: "email", args: JSON.parse(req.postData() || "{}") }); return { body: { ok: true } }; },
  notifications: async (req, url) => {
    if (req.method() === "PATCH") {
      const nid = (url.searchParams.get("id") || "").replace(/^eq\./, "");
      if (nid) await db.query("UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2", [nid, ME]);
      return { body: [] };
    }
    if (req.method() !== "GET" && req.method() !== "HEAD") return { body: [] };
    return { body: await all("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [ME]) };
  },
  profiles: () => ({ body: [profile] }),
  discovery_globe: () => ({ body: [{ user_id: ME, liked: null, trip: null, live_city_key: null, live_until: null, live_area: null }] }),
  discovery_settings: () => ({ body: { discoverable: true, matches_only: false, live_city_key: null, live_until: null, live_area: null } }),
  creative_match_list: () => ({ body: [] }),
  projects: async (req, url) => {
    const pid = (url.searchParams.get("id") || "").replace(/^eq\./, "");
    if (!pid) return null;
    const p = await one("SELECT * FROM projects WHERE id=$1", [pid]);
    const row = p && { ...p, description: "A lookbook for a spring capsule. Two looks, one location.", currency: "USD", total_budget: 800,
      timeline_end: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      project_roles: [{ id: "00000000-0000-4000-8000-0000000d0001", project_id: p.id, role_name: "Photographer", description: "Shoot two looks.", payout_amount: 400, slots_available: 1, slots_filled: 0, is_locked: false }] };
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    return { body: single ? row : row ? [row] : [] };
  },
  get_public_creator_profile: () => ({ body: [{ user_id: JADE, display_name: "Jade Okafor", avatar_url: null, city: "Charlotte, NC" }] }),
  events: async (req, url) => {
    const eid = (url.searchParams.get("id") || "").replace(/^eq\./, "");
    if (!eid) return null;
    const row = await eventRow(eid);
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    return { body: single ? row : row ? [row] : [] };
  },
};

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await signedIn(context);
const nudge = { userId: REZZA, name: "Rezza Monet", avatarUrl: null, role: "Photographer", skills: ["Portraits"], passions: [], city: "Charlotte, NC", tripCity: null, matched: true, conversationId: null, started: false, at: Date.now() };
await context.addInitScript(([key, value]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(key, value); sessionStorage.setItem("seeded", "1"); } }, [`ether:connect-nudge:${ME}`, JSON.stringify([nudge])]);
await context.route("https://covers.fixture.test/**", (route) => {
  const n = Number(route.request().url().split("/").pop().split(".")[0]);
  const hue = (n * 61) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 55% 55%)"/><stop offset="1" stop-color="hsl(${hue + 50} 50% 22%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><circle cx="84" cy="36" r="16" fill="#faf4ed" opacity=".5"/></svg>`;
  return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", async (m) => { if (m.type() === "error" && !/WebSocket|favicon|Failed to load resource/.test(m.text())) errors.push((await Promise.all(m.args().slice(0, 3).map((a) => a.jsonValue().catch(() => "?")))).join(" ").slice(0, 300) + " @ " + page.url().replace(root, "")); });
await mockSupabase(page, mock);
const report = { checks: {}, errors, calls };
let failed = 0;
const ok = (name, pass, detail) => { if (!pass) failed++; report.checks[name] = { pass, detail }; console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` :: ${detail}` : ""}`); };
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const sheet = () => page.getByRole("dialog");
const picker = () => page.getByTestId("invite-picker");
const rowFor = (title) => picker().getByTestId("invite-row").filter({ hasText: title });

// 1. The connect sheet, opened from "Start something".
await page.goto(root + "/explore", { waitUntil: "networkidle" });
const start = page.getByRole("button", { name: "Start", exact: true }).first();
await start.waitFor({ timeout: 20000 });
await start.scrollIntoViewIfNeeded();
await start.tap();
await sheet().getByText("What do you want to start together?").waitFor();
await sleep(500);
await shot("01-connect-sheet");
ok("cta-sheet-keeps-trip-and-note", (await sheet().getByRole("button", { name: /Plan a trip together/ }).count()) === 1 && (await sheet().getByRole("button", { name: /Message Rezza|Send Rezza a note/ }).count()) === 1);

// 2. Project picker instead of project setup.
await sheet().getByRole("button", { name: /Invite to a project or gig/ }).tap();
await picker().waitFor();
await rowFor("Night Shoot").waitFor();
await sleep(500);
ok("project-picker-not-create", page.url().endsWith("/explore"), page.url());
const projectRows = await picker().getByTestId("invite-row").evaluateAll((els) => els.map((e) => `${e.innerText.replace(/\s+/g, " ").trim()} [${e.dataset.state}]`));
ok("project-picker-sections", (await picker().getByText("Your projects and gigs").count()) === 1 && (await picker().getByText("Open near you").count()) === 1, projectRows.join(" | "));
ok("project-member-disabled", (await rowFor("Album cover").getAttribute("data-state")) === "off" && /Already in/.test(await rowFor("Album cover").innerText()));
await shot("02-project-picker");

await rowFor("Night Shoot").getByRole("button").tap();
await rowFor("Night Shoot").getByText("Sent").waitFor();
await sleep(400);
await shot("03-project-invite-sent");
const projInvites = await all("SELECT * FROM item_invites WHERE item_id=$1", [nightShoot]);
const rezzaNotes = await all("SELECT title, data FROM notifications WHERE user_id=$1 ORDER BY created_at", [REZZA]);
ok("project-invite-stored", projInvites.length === 1 && projInvites[0].sender_id === ME && projInvites[0].recipient_id === REZZA);
ok("project-invite-notifies", rezzaNotes.some((n) => n.title === "Maya Torres invited you to Night Shoot" && n.data.path === `/project/${nightShoot}`), rezzaNotes.map((n) => n.title).join(" | "));
ok("push-and-email-asked", calls.some((c) => c.fn === "push" && c.args.notification_type === "item_invite" && c.args.user_id === REZZA) && calls.some((c) => c.fn === "email" && c.args.data?.invite_id === projInvites[0].id));

// Duplicate guard 1: two fast taps on another row make one invite and one notice.
const gigButton = rowFor("Lookbook gig").getByRole("button");
await gigButton.waitFor();
await Promise.all([gigButton.tap({ force: true }), gigButton.tap({ force: true }).catch(() => undefined)]);
await rowFor("Lookbook gig").getByText("Sent").waitFor();
await sleep(400);
const gigInvites = await all("SELECT 1 FROM item_invites WHERE item_id=$1", [lookbook]);
const gigNotes = await all("SELECT 1 FROM notifications WHERE user_id=$1 AND data->>'item_id'=$2", [REZZA, lookbook]);
ok("double-tap-one-invite", gigInvites.length === 1 && gigNotes.length === 1, `${gigInvites.length} invites, ${gigNotes.length} notices`);

// 3. Event picker.
await picker().getByRole("button", { name: "Back" }).tap();
await sheet().getByRole("button", { name: /Invite to an event/ }).tap();
await rowFor("Gallery night").waitFor();
await sleep(500);
const eventRows = await picker().getByTestId("invite-row").evaluateAll((els) => els.map((e) => `${e.innerText.replace(/\s+/g, " ").trim()} [${e.dataset.state}]`));
ok("event-picker-sections", (await picker().getByText("Your events").count()) === 1 && (await picker().getByText("Happening near you").count()) === 1, eventRows.join(" | "));
ok("event-going-disabled", (await rowFor("Studio open house").getAttribute("data-state")) === "off" && /Going/.test(await rowFor("Studio open house").innerText()));
ok("event-their-own-disabled", (await rowFor("Listening party").getAttribute("data-state")) === "off" && /Their event/.test(await rowFor("Listening party").innerText()));
await shot("04-event-picker");
await rowFor("Gallery night").getByRole("button").tap();
await rowFor("Gallery night").getByText("Sent").waitFor();
await sleep(400);
await shot("05-event-invite-sent");
ok("event-invite-notifies", (await all("SELECT 1 FROM notifications WHERE user_id=$1 AND title='Maya Torres invited you to Gallery night'", [REZZA])).length === 1);

// Duplicate guard 2: reopening the project picker shows the earlier invites as Invited.
await picker().getByRole("button", { name: "Back" }).tap();
await sheet().getByRole("button", { name: /Invite to a project or gig/ }).tap();
await rowFor("Night Shoot").getByText("Invited").waitFor({ timeout: 8000 });
await sleep(400);
ok("reopen-shows-invited", (await rowFor("Night Shoot").getAttribute("data-state")) === "off" && (await rowFor("Lookbook gig").getAttribute("data-state")) === "off");
await shot("06-duplicate-guard-invited");
// Duplicate guard 3: the RPC itself, called again, does not make a second notice.
const again = await rpc("send_item_invite", { p_kind: "project", p_item: nightShoot, p_invitee: REZZA });
ok("rpc-repeat-is-idempotent", again.body.status === "already_invited" && (await all("SELECT 1 FROM notifications WHERE user_id=$1 AND data->>'item_id'=$2", [REZZA, nightShoot])).length === 1, JSON.stringify(again.body));

// Create a new one is still there, small, at the bottom.
ok("create-new-secondary", (await picker().getByRole("button", { name: /Create a new project or gig/ }).count()) === 1);
await page.keyboard.press("Escape");
await sleep(400);

// 4. The invitee's side: Rezza and Jade invite Maya; Maya sees, RSVPs and joins.
await as(db, "authenticated", REZZA);
const toMayaEvent = (await one("SELECT public.send_item_invite('event',$1,$2) r", [listening, ME])).r;
await as(db, "authenticated", JADE);
const toMayaGig = (await one("SELECT public.send_item_invite('project',$1,$2) r", [lookbook, ME])).r;
await db.exec("RESET ROLE");
ok("invites-to-maya-sent", toMayaEvent.status === "sent" && toMayaGig.status === "sent");
await page.goto(root + "/notifications", { waitUntil: "networkidle" });
const eventNotice = page.locator(".file-panel").filter({ hasText: "Rezza Monet invited you to Listening party" });
await eventNotice.waitFor({ timeout: 15000 });
await sleep(500);
await shot("07-invitee-notifications");
ok("invitee-sees-rsvp-and-join", (await eventNotice.getByRole("button", { name: "RSVP" }).count()) === 1 && (await page.locator(".file-panel").filter({ hasText: "Jade Okafor invited you to Lookbook gig" }).getByRole("button", { name: "Join" }).count()) === 1);
await eventNotice.getByRole("button", { name: "RSVP" }).tap();
await page.waitForURL(`**/event/${listening}`, { timeout: 10000 });
await sleep(1500);
await shot("08-after-rsvp-event-page");
const accepted = await one("SELECT status FROM item_invites WHERE id=$1", [toMayaEvent.id]);
const senderNote = await all("SELECT title FROM notifications WHERE user_id=$1 AND type='item_invite'", [REZZA]);
ok("accept-opens-event", page.url().endsWith(`/event/${listening}`) && accepted.status === "accepted", page.url());
ok("sender-hears-accept", senderNote.some((n) => n.title === "Maya Torres is checking out Listening party"), senderNote.map((n) => n.title).join(" | "));

await page.goto(root + "/notifications", { waitUntil: "networkidle" });
const gigNotice = page.locator(".file-panel").filter({ hasText: "Jade Okafor invited you to Lookbook gig" });
await gigNotice.waitFor();
await sleep(400);
ok("answered-shows-accepted", (await page.locator(".file-panel").filter({ hasText: "Listening party" }).getByText("Accepted").count()) === 1);
await gigNotice.getByRole("button", { name: "Join" }).tap();
await page.waitForURL(`**/project/${lookbook}`, { timeout: 10000 });
await sleep(1200);
await shot("09-after-join-project-page");
ok("join-opens-project", (await one("SELECT status FROM item_invites WHERE id=$1", [toMayaGig.id])).status === "accepted");

// 5. Empty states: no upcoming events of Maya's and nothing listed in her (new) city.
await db.query("UPDATE events SET removed_at=now() WHERE creator_id=$1", [ME]);
await db.query("UPDATE profiles SET city='Raleigh', city_key='raleigh|nc' WHERE user_id=$1", [ME]);
await page.evaluate(([key, value]) => localStorage.setItem(key, value), [`ether:connect-nudge:${ME}`, JSON.stringify([{ ...nudge, at: Date.now() }])]);
await page.goto(root + "/explore", { waitUntil: "networkidle" });
const again2 = page.getByRole("button", { name: "Start", exact: true }).first();
await again2.waitFor({ timeout: 20000 });
await again2.scrollIntoViewIfNeeded();
await again2.tap();
await sheet().getByRole("button", { name: /Invite to an event/ }).tap();
await picker().getByText("You have no upcoming events.").waitFor();
await sleep(400);
ok("empty-states", (await picker().getByText("No public events listed in your city right now.").count()) === 1 && (await picker().getByRole("button", { name: /Create a new event/ }).count()) === 1);
await shot("10-empty-states");
await picker().getByRole("button", { name: /Create a new event/ }).tap();
await page.waitForURL("**/calendar?action=create", { timeout: 10000 });
ok("create-new-opens-event-setup", page.url().endsWith("/calendar?action=create"), page.url());

report.failed = failed;
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`errors: ${errors.length ? errors.join(" || ") : "none"}`);
console.log(failed ? `${failed} checks failed` : "all phone checks passed");
await browser.close();
process.exit(failed ? 1 : 0);
