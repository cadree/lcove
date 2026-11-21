// Phone-size check: a profile that has old star reviews and a vouch shows
// vouches only. Talks to a local PGlite through the fixture backend.
//   ROOT=http://127.0.0.1:8130 OUT=/workspace/audit-nov15/bridge node scripts/hide-star-reviews-check.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { addUser, as, bridgeDb } from "./creative-bridge-fixture.mjs";
import { backend, signIn } from "./creative-bridge-backend.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8130";
const out = process.env.OUT || "/tmp/hide-star-reviews";
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = (n) => `00000000-0000-4000-8000-0000000b${String(n).padStart(4, "0")}`;
const MAYA = id(1), REZZA = id(2), THEO = id(3);
const avatar = (n) => `https://i.pravatar.cc/150?img=${n}`;

const { db } = await bridgeDb();
await addUser(db, MAYA, "Maya Torres", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(47), bio: "Photographer. Night light, film grain." });
await addUser(db, REZZA, "Rezza Monet", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(32), bio: "Stylist and creative director." });
await addUser(db, THEO, "Theo Grant", "charlotte|nc", { city_display: "Charlotte, NC", avatar_url: avatar(12), bio: "Lighting and grip." });
const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const all = async (sql, args) => (await db.query(sql, args)).rows;
const cover = "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400";
const nightShoot = (await one("INSERT INTO projects(creator_id,title,status,cover_image_url,timeline_end) VALUES($1,'Night Shoot','completed',$2,current_date) RETURNING id", [MAYA, cover])).id;
const photoRole = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Stylist',1) RETURNING id", [nightShoot])).id;
const lightRole = (await one("INSERT INTO project_roles(project_id,role_name,slots_available) VALUES($1,'Lighting',1) RETURNING id", [nightShoot])).id;
await db.query("INSERT INTO project_applications(project_id,role_id,applicant_id,status) VALUES($1,$2,$3,'accepted'),($1,$4,$5,'accepted')", [nightShoot, photoRole, REZZA, lightRole, THEO]);

// Old star review data stays in the database; the profile UI must not show it.
await db.exec(`
  CREATE TABLE IF NOT EXISTS public.user_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id uuid NOT NULL,
    reviewed_user_id uuid NOT NULL,
    rating int NOT NULL,
    title text,
    content text,
    project_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`);
await db.query(
  "INSERT INTO user_reviews(reviewer_id, reviewed_user_id, rating, title, content, project_id) VALUES($1,$2,5,'Great collaborator','Easy to work with on set.',$3)",
  [MAYA, REZZA, nightShoot],
);

await as(db, "authenticated", THEO);
await db.query("SELECT vouch_for($1,$2,$3)", [nightShoot, REZZA, "Pulled every look in two hours and kept the set calm."]);
await db.exec("RESET ROLE");

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail && !pass ? ` — ${detail}` : ""}`);
};

const log = [];
const install = backend(db, {
  rpcs: ["profile_vouches", "project_wrap_up", "vouch_for", "profile_credits", "post_credits"],
  log,
  fixed: {
    discovery_globe: async () => [],
    discovery_settings: async () => ({ discoverable: true, matches_only: false, live_city_key: null, live_until: null }),
    creative_match_list: async () => [],
  },
});

const browser = await chromium.launch({ channel: "chrome" });
const pages = [];
const allErrors = [];
process.on("uncaughtException", async (e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${out}/fail-${i}.png` }).catch(() => undefined);
  if (allErrors.length) console.error("page errors:", allErrors.slice(-3).join("\n---\n").slice(0, 3000));
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
const overflow = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - 390);

ok("star-review-row-kept", (await all("SELECT rating FROM user_reviews WHERE reviewed_user_id=$1", [REZZA]))[0]?.rating === 5);
ok("vouch-row-present", (await all("SELECT 1 FROM project_vouches WHERE author_id=$1 AND subject_id=$2", [THEO, REZZA])).length === 1);

const theo = await phone(THEO);
await theo.page.goto(root + `/profile/${REZZA}?section=vouches`, { waitUntil: "networkidle" });
const section = theo.page.locator("#profile-section-vouches");
await section.getByTestId("vouch-row").first().waitFor({ timeout: 15000 });
await sleep(800);
await shot(theo.page, "25-vouches-not-reviews-theo");
ok("vouch-shown", (await section.getByTestId("vouch-count").textContent()) === "1 vouch");
ok("vouch-note-shown", (await section.getByText("Pulled every look", { exact: false }).count()) === 1);
ok("no-reviews-heading", (await theo.page.getByRole("heading", { name: "Reviews", exact: true }).count()) === 0);
ok("no-write-review", (await theo.page.getByRole("button", { name: /Write Review/i }).count()) === 0);
ok("no-star-review-title", (await theo.page.getByText("Great collaborator", { exact: true }).count()) === 0);
ok("no-sideways-scroll-profile", (await overflow(theo.page)) <= 0);
ok("no-page-errors-theo", theo.errors.length === 0, theo.errors.join(" | "));

const rezza = await phone(REZZA);
await rezza.page.goto(root + "/profile", { waitUntil: "networkidle" });
await sleep(1200);
await rezza.page.getByRole("button", { name: "Edit Layout" }).tap();
const editorTitle = rezza.page.getByRole("heading", { name: "Edit Layout" });
await editorTitle.waitFor({ timeout: 10000 });
await sleep(400);
await shot(rezza.page, "26-layout-editor-no-reviews-rezza");
ok("layout-has-vouches", (await rezza.page.getByLabel("Reorder Vouches").count()) === 1);
ok("layout-hides-reviews", (await rezza.page.getByLabel("Reorder Reviews").count()) === 0);
ok("no-reviews-label-in-editor", (await rezza.page.getByText("Reviews", { exact: true }).count()) === 0);
// Scroll the editor list so later rows are in view (Reviews used to sit after Posts).
await rezza.page.locator(".safe-footer.overflow-y-auto, .safe-footer").evaluate((el) => { el.scrollTop = el.scrollHeight; });
await sleep(400);
await shot(rezza.page, "27-layout-editor-end-rezza");
ok("layout-end-has-no-reviews", (await rezza.page.getByLabel("Reorder Reviews").count()) === 0);
ok("no-page-errors-rezza", rezza.errors.length === 0, rezza.errors.join(" | "));

await Promise.all([theo.context.close(), rezza.context.close()]);
await browser.close();

const failed = results.filter((r) => !r.pass);
writeFileSync(`${out}/hide-reviews-results.json`, JSON.stringify(results, null, 2));
console.log(failed.length ? `${failed.length} failed` : `${results.length} passed`);
process.exit(failed.length ? 1 : 0);
