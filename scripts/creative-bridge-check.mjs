// Creative bridge at phone size (390x844, touch, mobile) with two or three
// signed-in people on separate phones. The app talks to a local PGlite with the
// real migrations and prod's rules (creative-bridge-backend.mjs); nothing touches
// a network database.
//   ROOT=http://127.0.0.1:8130 OUT=/workspace/audit-nov15/bridge node scripts/creative-bridge-check.mjs
// Run the app with VITE_SUPABASE_URL=https://fixture.supabase.co (any key).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { addUser, as, bridgeDb, has } from "./creative-bridge-fixture.mjs";
import { backend, signIn } from "./creative-bridge-backend.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8130";
const out = process.env.OUT || "/tmp/creative-bridge";
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = (n) => `00000000-0000-4000-8000-0000000b${String(n).padStart(4, "0")}`;
const MAYA = id(1), REZZA = id(2), THEO = id(3), JADE = id(4);
const avatar = (n) => `https://i.pravatar.cc/150?img=${n}`;

const { db } = await bridgeDb();
await addUser(db, MAYA, "Maya Torres", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(47), bio: "Photographer. Night light, film grain." });
await addUser(db, REZZA, "Rezza Monet", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(32), bio: "Stylist and creative director." });
await addUser(db, THEO, "Theo Grant", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(12), bio: "Lighting and grip." });
await addUser(db, JADE, "Jade Okafor", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(45), bio: "Producer." });
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const all = async (sql, args) => (await db.query(sql, args)).rows;
const cover = "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400";
const nightShoot = (await one("INSERT INTO projects(creator_id,title,status,cover_image_url,timeline_end) VALUES($1,'Night Shoot','in_progress',$2,current_date) RETURNING id", [MAYA, cover])).id;
const photoRole = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Stylist',1) RETURNING id", [nightShoot])).id;
const lightRole = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Lighting',1) RETURNING id", [nightShoot])).id;
await db.query("INSERT INTO project_applications(project_id,role_id,applicant_id,status) VALUES($1,$2,$3,'accepted'),($1,$4,$5,'accepted')", [nightShoot, photoRole, REZZA, lightRole, THEO]);
const post = (await one("INSERT INTO posts(user_id,content,media_type,media_url) VALUES($1,'Lookbook, day one.','photo',$2) RETURNING id", [MAYA, cover])).id;

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail && !pass ? ` — ${detail}` : ""}`);
};
const log = [];
const install = backend(db, {
  rpcs: [
    "profile_credits", "post_credits", "credit_post", "remove_post_credit", "respond_work_credit",
    ...(has("open_to") ? ["set_open_to"] : []),
  ],
  log,
  fixed: {
    // Explore's people deck: everyone else is on the globe, nobody decided yet.
    discovery_globe: async (viewer) =>
      (await all("SELECT user_id FROM profiles WHERE user_id<>$1", [viewer])).map((r) => ({
        user_id: r.user_id, liked: null, live_city_key: null, live_until: null, trip: null,
      })),
    discovery_settings: async () => ({ discoverable: true, matches_only: false, live_city_key: null, live_until: null }),
    creative_match_list: async () => [],
  },
  rows: {
    projects: async (p) => ({ ...p, project_roles: await all("SELECT * FROM project_roles WHERE project_id=$1", [p.id]) }),
  },
});

const browser = await chromium.launch({ channel: "chrome" });
const pages = [];
const allErrors = [];
process.on("uncaughtException", async (e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${out}/fail-${i}.png` }).catch(() => undefined);
  if (allErrors.length) console.error("page errors:", allErrors.slice(-3).join("\n---\n").slice(0, 3000));
  if (process.env.DEBUG_REST) console.error(JSON.stringify(log.slice(-40)));
  process.exit(1);
});
const phone = async (uid) => {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await signIn(context, uid);
  const page = await context.newPage();
  await install(page);
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); allErrors.push(e.stack || e.message); });
  pages.push(page);
  const cdp = await context.newCDPSession(page);
  return { context, page, errors, cdp };
};
const shot = async (page, name) => page.screenshot({ path: `${out}/${name}.png`, animations: "disabled" });
/** A real one-finger swipe (touchStart/Move/End) so scrolling runs through the browser's touch path. */
const swipe = async (cdp, { x = 195, from, to, steps = 12 }) => {
  const point = (y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from + ((to - from) * i) / steps) });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(500);
};
/** A sideways one-finger swipe, as on the people deck. */
const swipeX = async (cdp, { y, from, to, steps = 10 }) => {
  const point = (x) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from + ((to - from) * i) / steps) });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(700);
};
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// ============================================================ 1. credits
{
  // Maya marks Night Shoot complete (the existing status change); the database credits the team.
  await as(db, "authenticated", MAYA);
  await db.query("UPDATE projects SET status='completed' WHERE id=$1", [nightShoot]);
  await db.exec("RESET ROLE");
  ok("credits-created-on-complete", (await all("SELECT 1 FROM work_credits WHERE project_id=$1", [nightShoot])).length === 3);

  const rezza = await phone(REZZA);
  await rezza.page.goto(root + "/notifications", { waitUntil: "networkidle" });
  const notice = rezza.page.locator(".file-panel").filter({ hasText: "credited you as Stylist on Night Shoot" });
  await notice.waitFor({ timeout: 20000 });
  await sleep(400);
  await shot(rezza.page, "01-credit-notice-rezza");
  ok("credit-notice-shown", await notice.isVisible());
  await notice.tap();
  await rezza.page.waitForURL("**/profile?section=credits", { timeout: 10000 });
  const pending = rezza.page.getByTestId("credits-pending");
  await pending.waitFor({ timeout: 15000 });
  await sleep(1500);
  await shot(rezza.page, "02-credit-pending-rezza");
  ok("pending-credit-on-own-profile", (await pending.getByText("Night Shoot").count()) === 1);
  ok("pending-scrolled-into-view", await pending.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  await pending.getByRole("button", { name: "Accept" }).tap();
  await pending.waitFor({ state: "detached", timeout: 10000 });
  await rezza.page.locator("#profile-section-credits [data-testid=credit-row]").filter({ hasText: "Night Shoot" }).waitFor({ timeout: 10000 });
  await sleep(600);
  await shot(rezza.page, "03-credit-accepted-rezza");
  ok("accepted-toast", (await rezza.page.getByText("Credit added to your profile").count()) === 1);
  ok("credit-accepted", (await one("SELECT status FROM work_credits WHERE user_id=$1 AND project_id=$2", [REZZA, nightShoot])).status === "accepted");
  ok("no-sideways-scroll-profile", (await overflow(rezza.page)) <= 0);

  // Theo, on his own phone, sees Rezza's accepted credit and not his own pending one on her page.
  const theo = await phone(THEO);
  await theo.page.goto(root + `/profile/${REZZA}`, { waitUntil: "networkidle" });
  const section = theo.page.locator("#profile-section-credits");
  await section.waitFor({ timeout: 15000 });
  // Touch-scroll down to the section like a person would.
  for (let i = 0; i < 6 && !(await section.evaluate((el) => el.getBoundingClientRect().top < innerHeight - 120)); i++) {
    await swipe(theo.cdp, { from: 700, to: 250 });
  }
  await sleep(400);
  await shot(theo.page, "04-credit-on-rezza-profile-theo");
  ok("visitor-sees-accepted-credit", (await section.getByText("Night Shoot").count()) === 1 && (await section.getByText("Stylist").count()) >= 1);
  ok("visitor-no-pending-ui", (await theo.page.getByTestId("credits-pending").count()) === 0);
  ok("touch-scroll-moved", (await theo.page.evaluate(() => scrollY)) > 0);

  // Maya credits Jade on her post from the post sheet.
  const maya = await phone(MAYA);
  await maya.page.goto(root + `/profile/${MAYA}?post=${post}`, { waitUntil: "networkidle" });
  const creditBtn = maya.page.getByRole("button", { name: "Credit people" });
  await creditBtn.waitFor({ timeout: 15000 });
  await creditBtn.tap();
  await maya.page.getByLabel("Search members by name").fill("Jad");
  const jadeRow = maya.page.getByRole("button", { name: /Jade Okafor/ });
  await jadeRow.waitFor({ timeout: 10000 });
  await shot(maya.page, "05-credit-people-search-maya");
  await jadeRow.tap();
  await maya.page.getByLabel("Their role").fill("Producer");
  await shot(maya.page, "06-credit-people-role-maya");
  await maya.page.getByRole("button", { name: "Credit", exact: true }).tap();
  await sleep(1200);
  ok("post-credit-created", (await all("SELECT role,status FROM work_credits WHERE post_id=$1 AND user_id=$2", [post, JADE]))[0]?.role === "Producer");
  await maya.page.keyboard.press("Escape");
  await sleep(600);
  await shot(maya.page, "07-post-credit-waiting-maya");
  ok("author-sees-waiting-chip", (await maya.page.getByTestId("post-credits").getByText("· waiting").count()) === 1);

  // Theo opens the same post: the pending credit is not public yet.
  await theo.page.goto(root + `/profile/${MAYA}?post=${post}`, { waitUntil: "networkidle" });
  await sleep(1500);
  ok("pending-post-credit-private", (await theo.page.getByText("Jade Okafor").count()) === 0);
  for (const [who, p] of [["rezza", rezza], ["theo", theo], ["maya", maya]]) ok(`no-page-errors-${who}-credits`, p.errors.length === 0, p.errors.join(" | "));
  await Promise.all([rezza.context.close(), theo.context.close(), maya.context.close()]);
}

// ============================================================ 2. open to
if (has("open_to")) {
  const today = new Date().toISOString().slice(0, 10);
  const inMonth = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const rezza = await phone(REZZA);
  await rezza.page.goto(root + "/profile", { waitUntil: "networkidle" });
  const add = rezza.page.getByRole("button", { name: /Add what you're open to/ });
  await add.waitFor({ timeout: 15000 });
  await add.tap();
  const sheet = rezza.page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Shoots" }).tap();
  await sheet.getByRole("button", { name: "Paid gigs" }).tap();
  await sheet.getByLabel("Until (optional)").fill(inMonth);
  await sleep(300);
  await shot(rezza.page, "08-open-to-editor-rezza");
  ok("open-to-pressed-state", (await sheet.getByRole("button", { name: "Paid gigs" }).getAttribute("aria-pressed")) === "true");
  await sheet.getByRole("button", { name: "Save", exact: true }).tap();
  await rezza.page.getByText("Saved. People can see what you're open to.").waitFor({ timeout: 10000 });
  await rezza.page.getByTestId("profile-open-to").getByText("Paid gigs").waitFor({ timeout: 10000 });
  await sleep(500);
  await shot(rezza.page, "09-open-to-on-profile-rezza");
  const saved = await one("SELECT tags, until::text FROM profile_open_to WHERE user_id=$1", [REZZA]);
  ok("open-to-saved", [...(saved?.tags || [])].sort().join(",") === "paid_gigs,shoots" && saved.until === inMonth, JSON.stringify(saved));
  ok("no-sideways-scroll-open-to", (await overflow(rezza.page)) <= 0);

  // Theo browses people in Explore, swipes the deck, then filters to paid gigs.
  const theo = await phone(THEO);
  await theo.page.goto(root + "/explore?section=people", { waitUntil: "networkidle" });
  const slides = theo.page.locator("[aria-roledescription=slide]");
  await slides.first().waitFor({ timeout: 20000 });
  const filter = theo.page.getByTestId("open-to-filter");
  await filter.scrollIntoViewIfNeeded();
  ok("deck-has-everyone", (await slides.count()) === 3, String(await slides.count()));
  const deck = await slides.first().evaluate((el) => { const r = el.parentElement.getBoundingClientRect(); return { y: r.top + r.height / 2, left: el.parentElement.scrollLeft }; });
  await slides.first().scrollIntoViewIfNeeded();
  const box = await slides.first().boundingBox();
  await swipeX(theo.cdp, { y: box.y + box.height / 2, from: 330, to: 60 });
  ok("deck-touch-swipe-moved", (await slides.first().evaluate((el) => el.parentElement.scrollLeft)) > deck.left);
  await filter.scrollIntoViewIfNeeded();
  await filter.getByRole("button", { name: "Paid gigs" }).tap();
  await sleep(800);
  await shot(theo.page, "10-open-to-filter-explore-theo");
  ok("filter-leaves-open-people", (await slides.count()) === 1 && (await slides.first().getByText("Rezza Monet").count()) === 1);
  const card = slides.first().getByTestId("open-to-chips");
  ok("card-shows-open-to", (await card.getByText("Paid gigs").count()) === 1 && (await card.getByText("Shoots").count()) === 1);
  await slides.first().scrollIntoViewIfNeeded();
  await sleep(300);
  await shot(theo.page, "11-open-to-card-theo");
  await theo.page.getByRole("button", { name: /^See all/ }).tap();
  const grid = theo.page.getByRole("dialog");
  await grid.getByText("Rezza Monet").waitFor({ timeout: 10000 });
  await sleep(500);
  await shot(theo.page, "12-open-to-see-all-theo");
  ok("see-all-filtered", (await grid.getByRole("link").filter({ hasText: "Jade Okafor" }).count()) === 0 && (await grid.getByTestId("open-to-chips").count()) === 1);
  ok("no-sideways-scroll-explore", (await overflow(theo.page)) <= 0);

  // Expiry: once the end date passes, visitors stop seeing the tags and Rezza is asked to renew.
  await db.query("UPDATE profile_open_to SET until=$2::date - 1 WHERE user_id=$1", [REZZA, today]);
  await theo.page.goto(root + `/profile/${REZZA}`, { waitUntil: "networkidle" });
  await sleep(1500);
  ok("expired-hidden-from-visitor", (await theo.page.getByTestId("profile-open-to").count()) === 0);
  await rezza.page.reload({ waitUntil: "networkidle" });
  await rezza.page.getByText(/tags expired/).waitFor({ timeout: 10000 });
  await shot(rezza.page, "13-open-to-expired-rezza");
  ok("owner-asked-to-renew", true);
  for (const [who, p] of [["rezza", rezza], ["theo", theo]]) ok(`no-page-errors-${who}-open-to`, p.errors.length === 0, p.errors.join(" | "));
  await Promise.all([rezza.context.close(), theo.context.close()]);
}

await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
