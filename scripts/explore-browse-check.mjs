// Explore > Reels & posts: the Posts and Portfolios lanes render without the
// error boundary, and a story video never shows up as a reel.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const other = "00000000-0000-4000-8000-0000000000bb";
const post = (id, extra) => ({ id, user_id: other, content: `Post ${id}`, media_url: null, media_type: "text", post_type: "regular", created_at: "2026-11-13T12:00:00Z", updated_at: "2026-11-13T12:00:00Z", ...extra });
const posts = [
  post("00000000-0000-4000-8000-000000000801", { media_url: "https://fixture.supabase.co/storage/v1/object/public/media/v.mp4", media_type: "video" }),
  post("00000000-0000-4000-8000-000000000802", {}),
  post("00000000-0000-4000-8000-000000000803", { post_type: "portfolio", media_url: "https://fixture.supabase.co/storage/v1/object/public/media/p.jpg", media_type: "photo" }),
];
const stories = [{ id: "00000000-0000-4000-8000-000000000901", user_id: other, media_url: "https://fixture.supabase.co/storage/v1/object/public/media/story.mp4", media_type: "video", created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 864e5).toISOString() }];
const profiles = [{ user_id: other, display_name: "Rezza", avatar_url: null, city: "Charlotte", city_display: "Charlotte, NC" }];

const browser = await chromium.launch({ channel: "chrome" });
const failures = [];
for (const width of [390, 1280]) {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, isMobile: width < 600 });
  await signedIn(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockSupabase(page, {
    posts: (req) => (req.method() === "GET" ? { body: posts } : null),
    stories: (req) => (req.method() === "GET" ? { body: stories } : null),
    profiles_public: () => ({ body: profiles }),
  });
  await page.goto(`${root}/explore?section=browse`, { waitUntil: "networkidle" });
  const reelSources = await page.$$eval("article video", (videos) => videos.map((v) => v.getAttribute("src") || v.dataset.src || ""));
  if (reelSources.some((src) => src.includes("story.mp4"))) failures.push(`${width}: story shown as reel`);
  for (const lane of ["Posts", "Portfolios"]) {
    const clicked = await page.getByRole("button", { name: lane, exact: true }).click({ timeout: 5000 }).then(() => true, () => false);
    if (!clicked) { failures.push(`${width}: ${lane} lane button gone (page crashed?)`); continue; }
    await page.waitForTimeout(800);
    const crashed = await page.getByText(/something went wrong/i).count();
    if (crashed) failures.push(`${width}: ${lane} lane crashed`);
    await page.screenshot({ path: `/tmp/explore-${lane.toLowerCase()}-${width}.png` });
  }
  if (errors.length) failures.push(`${width}: ${errors.join(" | ").slice(0, 300)}`);
  await context.close();
}
await browser.close();
assert.deepEqual(failures, []);
console.log("explore browse check: OK", fixtures.me ? "" : "");
