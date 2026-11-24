/**
 * Posts and stories regression on staging in WebKit with touch (390 and 320).
 * Text, photo, video-with-custom-cover posts; edit a post; feed and profile;
 * photo and video stories from the gallery (WebKit here has no camera).
 *
 *   BASE=http://127.0.0.1:4182 OUT=/workspace/ether-audit/story-fixes-nov23/regression \
 *   node scripts/posts-regression-webkit.mjs
 *
 * Staging only; deletes what it created.
 */
import { chromium, webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4182";
const OUT = process.env.OUT ?? "/workspace/ether-audit/story-fixes-nov23/regression";
const ASSETS = "/workspace/ether-audit/posts-cover-nov23";
const STAGING_REF = "vjdrihmriufkameqngfg";
const keys = JSON.parse(fs.readFileSync("/workspace/secrets/ether-staging-keys.json", "utf8"));
const password = fs.readFileSync("/workspace/secrets/ether-staging-seed-password.txt", "utf8").trim();
if (!String(keys.url).includes(STAGING_REF)) throw new Error("staging only");
const anon = keys.publishable_key || keys.anon_key;
const login = await fetch(`${keys.url}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "ada@staging.ether.test", password }),
});
const session = await login.json();
if (!session.access_token) throw new Error("staging sign-in failed");
const userId = session.user.id;
const startedAt = new Date().toISOString();
const rest = (p, init = {}) => fetch(`${keys.url}${p}`, { ...init, headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } });
const stored = JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: session.user });
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const log = (line) => { console.log(line); results.push(line); };
// Linux Playwright WebKit crashes on H.264 files (no codec in this build), so
// VIDEO=chrome runs only the video steps in Google Chrome with touch.
const VIDEO = process.env.VIDEO ?? "skip";
const browser = VIDEO === "chrome"
  ? await chromium.launch({ executablePath: "/usr/bin/google-chrome" })
  : await webkit.launch();
const runs = (name) => (VIDEO === "chrome" ? /video/.test(name) : !/video/.test(name) || VIDEO === "webkit");

async function rows(table, extra = "") {
  const res = await rest(`/rest/v1/${table}?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(startedAt)}${extra}`);
  return res.ok ? res.json() : [];
}
async function waitRow(table, test, label) {
  for (let i = 0; i < 90; i += 1) {
    const found = (await rows(table)).find(test);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label}: no ${table} row`);
}

for (const vp of [390, 320]) {
  const context = await browser.newContext({ viewport: { width: vp, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark" });
  await context.addInitScript(({ k, v, uid }) => {
    if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); }
    localStorage.setItem("ether:get-the-app-dismissed", "1");
    localStorage.setItem(`ether:card-intro:${uid}`, "1");
    localStorage.setItem(`welcome_shown_${uid}`, "true");
  }, { k: `sb-${STAGING_REF}-auth-token`, v: stored, uid: userId });
  await context.route("**/aykopqinnnssxdhxqruo.supabase.co/**", (r) => r.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${VIDEO === "chrome" ? "chrome" : "webkit"}-${vp}-${name}.png`) });
  const mark = `regress-${VIDEO}-${vp}-${Date.now().toString(36)}`;
  const step = async (name, fn) => {
    if (!runs(name)) return;
    try { await fn(); log(`${vp} PASS ${name}`); } catch (e) { log(`${vp} FAIL ${name}: ${String(e.message).split("\n")[0].slice(0, 220)}`); await shot(`fail-${name.replace(/\W+/g, "-")}`).catch(() => {}); }
  };
  const openPost = async () => {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Create" }).first().tap();
    await page.getByRole("button", { name: "Post", exact: true }).tap();
    await page.getByRole("button", { name: "Choose a photo" }).waitFor();
  };
  const finish = async (caption) => {
    await page.getByLabel("Post caption").fill(caption);
    await page.getByRole("button", { name: "Next", exact: true }).tap();
    await page.getByRole("button", { name: "Share", exact: true }).tap();
  };

  await step("text post", async () => {
    await openPost();
    await page.getByRole("button", { name: "Caption only" }).tap();
    await finish(`${mark} text`);
    const row = await waitRow("posts", (r) => r.content === `${mark} text`, "text post");
    log(`${vp}   text post media_type=${row.media_type}`);
  });

  await step("photo post", async () => {
    await openPost();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose a photo" }).tap();
    await (await chooser).setFiles(`${ASSETS}/cover-upload.jpg`);
    await page.getByRole("button", { name: "Next", exact: true }).tap();
    await finish(`${mark} photo`);
    const row = await waitRow("posts", (r) => r.content === `${mark} photo` && r.media_url, "photo post");
    log(`${vp}   photo post media_type=${row.media_type}`);
  });

  await step("video post with custom cover", async () => {
    await openPost();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose a video" }).tap();
    await (await chooser).setFiles(`${ASSETS}/cover-test.mp4`);
    await page.locator('[data-testid="video-cover-picker"]').waitFor();
    await page.locator('[data-testid="video-cover-upload"]').setInputFiles(`${ASSETS}/cover-upload.jpg`);
    await page.waitForTimeout(800);
    await shot("video-cover-picked");
    await finish(`${mark} video`);
    const row = await waitRow("posts", (r) => r.content === `${mark} video` && r.media_url, "video post");
    const cover = row.thumbnail_url ?? row.cover_url ?? row.poster_url ?? null;
    log(`${vp}   video post media_type=${row.media_type} cover=${cover ? "set" : "missing"}`);
    if (!cover) throw new Error(`no cover column set (${Object.keys(row).filter((k) => /thumb|cover|poster/.test(k)).join(",")})`);
  });

  await step("video post shows in feed and profile", async () => {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
    await page.getByText(`${mark} video`).first().waitFor({ timeout: 25000 });
    await shot("feed-video");
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await shot("profile-video");
  });

  await step("feed shows the new posts", async () => {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
    await page.getByText(`${mark} photo`).first().waitFor({ timeout: 25000 });
    await shot("feed");
    for (const kind of ["text"]) await page.getByText(`${mark} ${kind}`).first().waitFor({ timeout: 10000 });
  });

  await step("profile shows the new posts", async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    await page.getByText(`${mark} text`).first().waitFor({ timeout: 25000 });
    await shot("profile");
  });

  await step("edit a post", async () => {
    await page.getByText(`${mark} text`).first().tap();
    await page.getByRole("button", { name: "Post options" }).first().tap();
    await page.getByRole("menuitem", { name: "Edit Post" }).tap();
    const field = page.locator('[role="dialog"] textarea').last();
    await field.fill(`${mark} text edited`);
    await page.getByRole("button", { name: "Save" }).tap();
    await waitRow("posts", (r) => r.content === `${mark} text edited`, "edited post");
    await page.waitForTimeout(800);
    await shot("after-edit");
  });

  const story = async (file, kind) => {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Create" }).first().tap();
    await page.getByRole("button", { name: "Story", exact: true }).tap();
    await page.locator("[data-story-composer]").waitFor();
    await page.locator('[data-story-stage="fallback"], [data-story-stage="camera"]').first().waitFor({ timeout: 20000 });
    await page.locator("[data-story-gallery-input]").setInputFiles(file);
    await page.locator('[data-story-stage="editor"]').waitFor();
    await page.waitForTimeout(800);
    await shot(`story-${kind}-editor`);
    await page.locator("[data-story-share]").tap();
    const row = await waitRow("stories", (r) => r.media_type === kind, `${kind} story`);
    log(`${vp}   ${kind} story posted (${row.media_url.split(".").pop()})`);
  };
  await step("photo story", () => story(`${ASSETS}/cover-upload.jpg`, "photo"));
  await step("video story", () => story(`${ASSETS}/cover-test.mp4`, "video"));
  if (errors.length) log(`${vp} page errors: ${[...new Set(errors)].join(" | ")}`);
  await context.close();
}
await browser.close();

// Cleanup: posts and stories created by this run, with their files.
const media = (url) => (String(url || "").match(/\/storage\/v1\/object\/public\/media\/(.+)$/) || [])[1];
let removed = 0;
for (const table of ["posts", "stories"]) {
  for (const row of await rows(table)) {
    const files = [row.media_url, row.thumbnail_url, row.cover_url].map(media).filter(Boolean).map(decodeURIComponent);
    if (files.length) await rest(`/storage/v1/object/media`, { method: "DELETE", body: JSON.stringify({ prefixes: files }) });
    const del = await rest(`/rest/v1/${table}?id=eq.${row.id}`, { method: "DELETE" });
    if (del.ok) removed += 1;
  }
}
log(`cleanup: removed ${removed} staging rows created by this run`);
fs.writeFileSync(path.join(OUT, `results-${VIDEO === "chrome" ? "chrome-video" : "webkit"}.txt`), results.join("\n") + "\n");
