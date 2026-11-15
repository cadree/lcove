// Connect → invite to an existing project/gig or event, at phone size (390x844, touch).
// The app runs against fixture Supabase routes; invite RPCs, notifications, chats,
// messages, roles, applications, RSVPs and tickets run on a local PGlite with the
// real item_invites migration and prod's chat rules (no network database). Each
// request runs as the signed-in user from its bearer token, under RLS, so a
// second phone signed in as Rezza sees only what Rezza may see.
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
const ticketed = (await one("INSERT INTO events(creator_id,title,venue,city,start_date,image_url,ticket_type) VALUES($1,'Ticketed show','The Underground','Charlotte',$2,$3,'paid') RETURNING id", [JADE, at(10, 0), cover(6)])).id;
await db.query("INSERT INTO ticket_tiers(event_id,name,price_cents) VALUES($1,'General admission',2500)", [ticketed]);
await db.query("INSERT INTO project_roles(project_id,role_name,description,payout_amount,slots_available) VALUES($1,'Photographer','Shoot the night scenes.',400,1),($1,'Stylist','Wardrobe for two looks.',250,1)", [nightShoot]);
await db.query("INSERT INTO project_roles(project_id,role_name,description,payout_amount,slots_available) VALUES($1,'Creative director','Run the look and the shot list.',500,1)", [lookbook]);

const calls = [];
// The signed-in user of a request, from its bearer token (the fixture JWT's sub).
const viewerOf = (req) => {
  try {
    const token = (req.headers()["authorization"] || "").replace(/^Bearer /, "");
    const sub = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
    return /^[0-9a-f-]{36}$/.test(sub) ? sub : ME;
  } catch {
    return ME;
  }
};
const RPC_SQL = {
  item_invite_targets: ["SELECT public.item_invite_targets($1,$2) r", (a) => [a.p_invitee, a.p_kind]],
  send_item_invite: ["SELECT public.send_item_invite($1,$2,$3) r", (a) => [a.p_kind, a.p_item, a.p_invitee]],
  respond_item_invite: ["SELECT public.respond_item_invite($1,$2) r", (a) => [a.p_invite, a.p_accept]],
  item_invite_card: ["SELECT public.item_invite_card($1) r", (a) => [a.p_invite]],
  item_invite_apply: ["SELECT public.item_invite_apply($1,$2,$3) r", (a) => [a.p_invite, a.p_role, a.p_message ?? null]],
};
const rpc = async (fn, args, viewer = ME) => {
  await as(db, "authenticated", viewer);
  try {
    const [sql, params] = RPC_SQL[fn];
    return { body: (await one(sql, params(args))).r };
  } catch (e) {
    return { status: 400, body: { message: e.message, code: "P0001" } };
  } finally {
    await db.exec("RESET ROLE");
  }
};
const handle = (fn) => async (req) => {
  const args = JSON.parse(req.postData() || "{}");
  const viewer = viewerOf(req);
  calls.push({ fn, args, viewer });
  return rpc(fn, args, viewer);
};

// A small PostgREST stand-in for plain table reads and writes (eq, neq, in, is,
// gt/gte/lt/lte, like, order, limit; inserts and updates), run as the request's
// user so the real RLS policies decide what comes back.
const columnsOf = new Map();
const tableColumns = async (table) => {
  if (!columnsOf.has(table)) {
    columnsOf.set(table, new Set((await all("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table])).map((r) => r.column_name)));
  }
  return columnsOf.get(table);
};
const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE" };
const pgrest = (table, extraRow = (r) => r) => async (req, url) => {
  const cols = await tableColumns(table);
  const params = [];
  const where = [];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key) || !cols.has(key)) continue;
    const [op, ...rest] = raw.split(".");
    const value = rest.join(".");
    if (op === "is") where.push(`${key} IS ${value === "null" ? "NULL" : value === "true" ? "TRUE" : "FALSE"}`);
    else if (op === "in") { params.push(value.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""))); where.push(`${key}::text = ANY($${params.length}::text[])`); }
    else if (OPS[op]) { params.push(op === "like" ? value.replace(/\*/g, "%") : value); where.push(`${key} ${OPS[op]} $${params.length}`); }
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const viewer = viewerOf(req);
  const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
  await as(db, "authenticated", viewer);
  try {
    let rows;
    if (req.method() === "GET" || req.method() === "HEAD") {
      const order = (url.searchParams.get("order") || "").split(",").map((o) => o.split(".")).filter(([c]) => cols.has(c))
        .map(([c, dir]) => `${c} ${dir === "desc" ? "DESC" : "ASC"}`).join(", ");
      const limit = Number(url.searchParams.get("limit")) || null;
      rows = await all(`SELECT * FROM public.${table}${whereSql}${order ? ` ORDER BY ${order}` : ""}${limit ? ` LIMIT ${limit}` : ""}`, params);
      if (req.method() === "HEAD" || (req.headers()["prefer"] || "").includes("count=exact")) {
        return { status: 200, headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`, "access-control-expose-headers": "content-range", "access-control-allow-origin": "*", "content-type": "application/json" }, body: req.method() === "HEAD" ? "" : rows.map(extraRow) };
      }
    } else if (req.method() === "POST") {
      const payload = JSON.parse(req.postData() || "[]");
      rows = [];
      for (const item of Array.isArray(payload) ? payload : [payload]) {
        const keys = Object.keys(item).filter((k) => cols.has(k));
        rows.push(await one(`INSERT INTO public.${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, keys.map((k) => item[k])));
      }
    } else if (req.method() === "PATCH") {
      const payload = JSON.parse(req.postData() || "{}");
      const keys = Object.keys(payload).filter((k) => cols.has(k));
      if (!keys.length) return { body: single ? null : [] };
      const set = keys.map((k, i) => `${k} = $${params.length + i + 1}`).join(", ");
      rows = await all(`UPDATE public.${table} SET ${set}${whereSql} RETURNING *`, [...params, ...keys.map((k) => payload[k])]);
    } else {
      return { body: [] };
    }
    rows = rows.map(extraRow);
    return { body: single ? rows[0] ?? null : rows };
  } catch (e) {
    if (process.env.DEBUG_REST) console.error(`REST ${req.method()} ${table} ${url.search} -> ${e.message}`);
    return { status: 400, body: { message: e.message, code: e.code || "P0001" } };
  } finally {
    await db.exec("RESET ROLE");
  }
};
const profileRow = async (uid) => {
  const p = await one("SELECT * FROM profiles WHERE user_id=$1", [uid]);
  return p && { id: p.user_id, user_id: p.user_id, display_name: p.display_name, avatar_url: null, city: p.city, city_display: "Charlotte, NC", city_key: p.city_key, bio: "", onboarding_completed: true, access_status: "active", created_at: new Date().toISOString() };
};
const eventRow = async (eid) => {
  const e = await one("SELECT * FROM events WHERE id=$1", [eid]);
  return e && { ...e, description: "An evening of new music.", address: null, state: "NC", country: "US", ticket_type: e.ticket_type || "free", ticket_price: null, credits_price: null, capacity: null, timezone: "America/New_York", event_type: "in_person", requires_approval: false, waitlist_enabled: false, features: [], slug: null, hide_address: false, created_at: e.start_date, updated_at: e.start_date };
};
const mock = {
  item_invite_targets: handle("item_invite_targets"),
  send_item_invite: handle("send_item_invite"),
  respond_item_invite: handle("respond_item_invite"),
  item_invite_card: handle("item_invite_card"),
  item_invite_apply: handle("item_invite_apply"),
  conversation_participants: pgrest("conversation_participants"),
  conversations: pgrest("conversations"),
  messages: pgrest("messages"),
  project_applications: pgrest("project_applications"),
  event_rsvps: pgrest("event_rsvps"),
  ticket_tiers: pgrest("ticket_tiers", (t) => ({ ...t, description: null, capacity: null, quantity_sold: 0, currency: "usd", sort_order: 0 })),
  profiles_public: async (req, url) => {
    const ids = (url.searchParams.get("user_id") || "").replace(/^(in\.\(|eq\.)|\)$/g, "").split(",").filter(Boolean);
    return { body: (await Promise.all(ids.map(profileRow))).filter(Boolean).map((p) => ({ user_id: p.user_id, display_name: p.display_name, avatar_url: null })) };
  },
  "send-push-notification": (req) => { calls.push({ fn: "push", args: JSON.parse(req.postData() || "{}") }); return { body: { ok: true } }; },
  "send-notification-email": (req) => { calls.push({ fn: "email", args: JSON.parse(req.postData() || "{}") }); return { body: { ok: true } }; },
  notifications: async (req, url) => {
    if (req.method() === "PATCH") {
      const nid = (url.searchParams.get("id") || "").replace(/^eq\./, "");
      if (nid) await db.query("UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2", [nid, ME]);
      return { body: [] };
    }
    if (req.method() !== "GET" && req.method() !== "HEAD") return { body: [] };
    return { body: await all("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [viewerOf(req)]) };
  },
  profiles: async (req, url) => {
    const asked = (url.searchParams.get("user_id") || url.searchParams.get("id") || "").replace(/^eq\./, "");
    const row = await profileRow(/^[0-9a-f-]{36}$/.test(asked) ? asked : viewerOf(req));
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    return { body: single ? row : row ? [row] : [] };
  },
  discovery_globe: () => ({ body: [{ user_id: ME, liked: null, trip: null, live_city_key: null, live_until: null, live_area: null }] }),
  discovery_settings: () => ({ body: { discoverable: true, matches_only: false, live_city_key: null, live_until: null, live_area: null } }),
  creative_match_list: () => ({ body: [] }),
  projects: async (req, url) => {
    const pid = (url.searchParams.get("id") || "").replace(/^eq\./, "");
    if (!/^[0-9a-f-]{36}$/.test(pid)) return null;
    const p = await one("SELECT * FROM projects WHERE id=$1", [pid]);
    const row = p && { ...p, description: "A lookbook for a spring capsule. Two looks, one location.", currency: "USD", total_budget: 800,
      timeline_end: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      project_roles: (await all("SELECT * FROM project_roles WHERE project_id=$1 ORDER BY created_at, role_name", [p.id])).map((r) => ({ ...r, payout_amount: Number(r.payout_amount), credit_amount: 0 })) };
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    return { body: single ? row : row ? [row] : [] };
  },
  get_public_creator_profile: async (req) => {
    const p = await profileRow(JSON.parse(req.postData() || "{}").creator_user_id);
    return { body: p ? [{ user_id: p.user_id, display_name: p.display_name, avatar_url: null, city: "Charlotte, NC" }] : [] };
  },
  events: async (req, url) => {
    const eid = (url.searchParams.get("id") || "").replace(/^eq\./, "");
    if (!/^[0-9a-f-]{36}$/.test(eid)) return null;
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
let second = null;
process.on("uncaughtException", async (e) => { console.error(e); console.error("page errors: " + errors.join(" || ")); try { await page.screenshot({ path: `${out}/debug-failure.png` }); console.error("at " + page.url()); if (second) { await second.screenshot({ path: `${out}/debug-failure-2.png` }); console.error("second at " + second.url()); } } catch {} process.exit(1); });
process.on("unhandledRejection", async (e) => { console.error(e); try { await page.screenshot({ path: `${out}/debug-failure.png` }); console.error("at " + page.url()); } catch {} process.exit(1); });
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
await page.waitForURL(`**/event/${listening}?invite=${toMayaEvent.id}`, { timeout: 10000 });
await page.getByTestId("invite-rsvp-banner").waitFor({ timeout: 10000 });
await page.getByTestId("invite-rsvp-banner").scrollIntoViewIfNeeded();
await sleep(1200);
await shot("08-free-event-rsvp-step");
const accepted = await one("SELECT status FROM item_invites WHERE id=$1", [toMayaEvent.id]);
const senderNote = await all("SELECT title FROM notifications WHERE user_id=$1 AND type='item_invite'", [REZZA]);
const cardAs = async (invite, viewer) => (await rpc("item_invite_card", { p_invite: invite }, viewer)).body;
ok("accept-opens-event-rsvp-step", accepted.status === "accepted" && page.url().includes(`/event/${listening}?invite=`), page.url());
ok("accept-is-not-going", (await all("SELECT 1 FROM event_rsvps WHERE event_id=$1 AND user_id=$2", [listening, ME])).length === 0 && (await cardAs(toMayaEvent.id, ME)).stage === "accepted");
ok("sender-hears-accept", senderNote.some((n) => n.title === "Maya Torres accepted your invite to Listening party"), senderNote.map((n) => n.title).join(" | "));
// Free event: the page's own RSVP button is what makes her going.
await page.getByRole("button", { name: /^RSVP/ }).last().tap();
await page.waitForURL(`**/event/${listening}/confirmation**`, { timeout: 10000 });
await sleep(800);
ok("free-event-rsvp-makes-going", (await all("SELECT status FROM event_rsvps WHERE event_id=$1 AND user_id=$2", [listening, ME]))[0]?.status === "going" && (await cardAs(toMayaEvent.id, REZZA)).stage === "going", page.url());

await page.goto(root + "/notifications", { waitUntil: "networkidle" });
const gigNotice = page.locator(".file-panel").filter({ hasText: "Jade Okafor invited you to Lookbook gig" });
await gigNotice.waitFor();
await sleep(400);
ok("answered-shows-accepted", (await page.locator(".file-panel").filter({ hasText: "invited you to Listening party" }).getByText("Accepted").count()) === 1);
await gigNotice.getByRole("button", { name: "Join" }).tap();
await page.waitForURL(`**/project/${lookbook}?invite=${toMayaGig.id}`, { timeout: 10000 });
await page.getByTestId("invite-role-banner").waitFor({ timeout: 10000 });
await sleep(1000);
await shot("09-role-picker-from-notice");
ok("join-opens-role-picker", (await one("SELECT status FROM item_invites WHERE id=$1", [toMayaGig.id])).status === "accepted" && (await page.getByRole("button", { name: /Creative director/ }).count()) === 1);
await page.getByRole("button", { name: /Creative director/ }).tap();
await page.getByRole("button", { name: "Choose this role" }).tap();
await page.getByText("You're on the project").waitFor({ timeout: 10000 });
await sleep(600);
await shot("10-joined-from-owner-invite");
const lookbookChat = await one("SELECT c.id FROM conversations c WHERE c.project_id=$1 AND c.type='group'", [lookbook]);
const mayaInChat = lookbookChat && await one("SELECT project_role_name FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2", [lookbookChat.id, ME]);
ok("owner-invite-role-joins-project-chat", mayaInChat?.project_role_name === "Creative director"
  && (await all("SELECT 1 FROM messages WHERE conversation_id=$1 AND content='🎉 Maya Torres joined the project as Creative director'", [lookbookChat.id])).length === 1);

// 6. The invite card in the direct chat, on both phones.
const dm = await one("SELECT conversation_id FROM item_invites WHERE item_id=$1 AND recipient_id=$2", [nightShoot, REZZA]);
const dmMessages = await all("SELECT content, shared_invite_id FROM messages WHERE conversation_id=$1 ORDER BY created_at", [dm.conversation_id]);
ok("cards-posted-in-one-dm", dmMessages.filter((m) => m.shared_invite_id).length === 4, dmMessages.map((m) => m.content).join(" | "));
const card = (pg, title) => pg.getByTestId("invite-card").filter({ hasText: title });
await page.goto(root + `/messages?chat=${dm.conversation_id}`, { waitUntil: "networkidle" });
await card(page, "Night Shoot").waitFor({ timeout: 15000 });
await card(page, "Night Shoot").scrollIntoViewIfNeeded();
await sleep(800);
await shot("11-sender-sees-card");
ok("sender-card-waiting", /Waiting on Rezza/.test(await card(page, "Night Shoot").innerText()) && (await card(page, "Night Shoot").getByRole("button", { name: "Join" }).count()) === 0);

const rezzaContext = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const rezzaUser = { id: REZZA, aud: "authenticated", role: "authenticated", email: "rezza@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };
const rezzaSession = { access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: REZZA, role: "authenticated", aud: "authenticated", exp: 4102444800 })}.fixture`, token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "fixture", user: rezzaUser };
// A real (fixture) session for Rezza, not the dev screenshot user, so the app is Rezza's.
await rezzaContext.addInitScript(([session, uid]) => {
  localStorage.setItem(`welcome_shown_${uid}`, "true");
  localStorage.setItem("welcome_shown_00000000-0000-4000-8000-0000000000aa", "true");
  localStorage.setItem("sb-fixture-auth-token", session);
}, [JSON.stringify(rezzaSession), REZZA]);
await rezzaContext.route("https://covers.fixture.test/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="hsl(200 50% 40%)"/></svg>` }));
const rezza = await rezzaContext.newPage();
second = rezza;
rezza.on("pageerror", (e) => errors.push("rezza: " + e.message));
await mockSupabase(rezza, mock);
await rezza.route("**/auth/v1/user", (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(rezzaUser) }));
const rshot = (name) => rezza.screenshot({ path: `${out}/${name}.png` });
await rezza.goto(root + `/messages?chat=${dm.conversation_id}`, { waitUntil: "networkidle" });
await card(rezza, "Night Shoot").waitFor({ timeout: 15000 });
await card(rezza, "Night Shoot").scrollIntoViewIfNeeded();
await sleep(800);
await rshot("12-invitee-sees-card");
ok("invitee-card-has-join", (await card(rezza, "Night Shoot").getByRole("button", { name: "Join" }).count()) === 1 && (await card(rezza, "Night Shoot").getByRole("button", { name: "Not now" }).count()) === 1);
await card(rezza, "Night Shoot").getByRole("button", { name: "Join" }).tap();
await rezza.waitForURL(`**/project/${nightShoot}?invite=**`, { timeout: 10000 });
await rezza.getByTestId("invite-role-banner").waitFor({ timeout: 10000 });
await sleep(1000);
await rshot("13-role-picker-from-card");
ok("card-join-opens-role-picker", (await rezza.getByRole("button", { name: /Photographer/ }).count()) === 1 && (await rezza.getByRole("button", { name: /Stylist/ }).count()) === 1);
const acceptLine = await one("SELECT content FROM messages WHERE conversation_id=$1 AND sender_id=$2 AND content LIKE 'Accepted your invite to Night Shoot%'", [dm.conversation_id, REZZA]);
ok("accept-line-in-dm", acceptLine?.content === "Accepted your invite to Night Shoot. Picking a role now.");
await rezza.getByRole("button", { name: /Photographer/ }).tap();
await rezza.getByRole("button", { name: "Choose this role" }).tap();
await rezza.getByText("You're on the project").waitFor({ timeout: 10000 });
await sleep(500);
await rshot("14-invitee-joined-toast");
const nightChat = await one("SELECT id FROM conversations WHERE project_id=$1 AND type='group'", [nightShoot]);
ok("invitee-added-to-project-chat", !!nightChat && (await one("SELECT project_role_name FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2", [nightChat.id, REZZA]))?.project_role_name === "Photographer");
await rezza.getByRole("button", { name: "Open chat" }).dispatchEvent("click");
await rezza.waitForURL("**/messages**", { timeout: 10000 });
await rezza.getByText("🎉 Rezza Monet joined the project as Photographer", { exact: true }).waitFor({ timeout: 15000 });
await rezza.getByText("🎉 Rezza Monet joined the project as Photographer", { exact: true }).scrollIntoViewIfNeeded();
await sleep(600);
await rshot("15-invitee-in-project-chat");
ok("project-chat-shows-join-line", await rezza.getByText("🎉 Rezza Monet joined the project as Photographer", { exact: true }).isVisible());

await rezza.goto(root + `/messages?chat=${dm.conversation_id}`, { waitUntil: "networkidle" });
await card(rezza, "Night Shoot").getByText("You joined as Photographer").waitFor({ timeout: 15000 });
await card(rezza, "Night Shoot").scrollIntoViewIfNeeded();
await sleep(600);
await rshot("16-invitee-card-joined");
await page.goto(root + `/messages?chat=${dm.conversation_id}`, { waitUntil: "networkidle" });
await card(page, "Night Shoot").getByText("Rezza joined as Photographer").waitFor({ timeout: 15000 });
await page.getByText("Accepted your invite to Night Shoot. Picking a role now.").scrollIntoViewIfNeeded();
await sleep(600);
await shot("17-sender-card-updated");
ok("card-updates-for-both", (await card(page, "Night Shoot").getAttribute("data-stage")) === "joined" && (await one("SELECT 1 AS x FROM messages WHERE conversation_id=$1 AND sender_id=$2 AND content LIKE 'Accepted your invite to Night Shoot%'", [dm.conversation_id, REZZA]))?.x === 1);
await rezzaContext.close();

// Paid event from the card: RSVP goes to tickets and on to checkout; accept is not going.
await as(db, "authenticated", JADE);
const toMayaPaid = (await one("SELECT public.send_item_invite('event',$1,$2) r", [ticketed, ME])).r;
await db.exec("RESET ROLE");
const jadeDm = (await one("SELECT conversation_id FROM item_invites WHERE id=$1", [toMayaPaid.id])).conversation_id;
await page.goto(root + `/messages?chat=${jadeDm}`, { waitUntil: "networkidle" });
await card(page, "Ticketed show").waitFor({ timeout: 15000 });
await card(page, "Ticketed show").scrollIntoViewIfNeeded();
await sleep(600);
await shot("18-paid-event-card");
await card(page, "Ticketed show").getByRole("button", { name: "RSVP" }).tap();
await page.waitForURL(`**/event/${ticketed}/tickets`, { timeout: 10000 });
await page.getByText("General admission").waitFor({ timeout: 10000 });
await sleep(800);
await shot("19-paid-event-tickets");
ok("paid-accept-goes-to-tickets", (await cardAs(toMayaPaid.id, ME)).stage === "accepted" && (await cardAs(toMayaPaid.id, ME)).ticket_required === true
  && (await all("SELECT 1 FROM event_rsvps WHERE event_id=$1 AND user_id=$2", [ticketed, ME])).length === 0);
await page.getByRole("button", { name: "More General admission" }).tap();
await page.getByRole("button", { name: "Select tickets" }).tap();
await page.waitForURL(`**/event/${ticketed}/checkout`, { timeout: 10000 });
await sleep(1000);
await shot("20-paid-event-checkout");
ok("paid-event-reaches-checkout", page.url().endsWith(`/event/${ticketed}/checkout`), page.url());
await page.goto(root + `/messages?chat=${jadeDm}`, { waitUntil: "networkidle" });
await card(page, "Ticketed show").getByRole("button", { name: "Get a ticket" }).waitFor({ timeout: 15000 });
ok("paid-card-keeps-get-a-ticket", /Accepted · getting a ticket/.test(await card(page, "Ticketed show").innerText()));
await db.query("INSERT INTO event_attendees(event_id,attendee_user_id,status) VALUES($1,$2,'registered')", [ticketed, ME]);
await page.goto(root + `/messages?chat=${jadeDm}`, { waitUntil: "networkidle" });
await card(page, "Ticketed show").getByText("You're going").waitFor({ timeout: 15000 });
await card(page, "Ticketed show").scrollIntoViewIfNeeded();
await sleep(500);
await shot("21-paid-event-card-going");
ok("paid-card-going-after-ticket", (await card(page, "Ticketed show").getAttribute("data-stage")) === "going");

// 7. Empty states: no upcoming events of Maya's and nothing listed in her (new) city.
await db.query("UPDATE events SET removed_at=now() WHERE creator_id=$1", [ME]);
// Earlier steps made her going to two events; those count as "yours" too.
await db.query("DELETE FROM event_rsvps WHERE user_id=$1", [ME]);
await db.query("DELETE FROM event_attendees WHERE attendee_user_id=$1", [ME]);
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
await shot("22-empty-states");
await picker().getByRole("button", { name: /Create a new event/ }).tap();
await page.waitForURL("**/calendar?action=create", { timeout: 10000 });
ok("create-new-opens-event-setup", page.url().endsWith("/calendar?action=create"), page.url());

report.failed = failed;
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`errors: ${errors.length ? errors.join(" || ") : "none"}`);
console.log(failed ? `${failed} checks failed` : "all phone checks passed");
await browser.close();
process.exit(failed ? 1 : 0);
