// Before/after screenshots of the areas changed in the Nov 14 audit.
// Usage: ROOT=http://127.0.0.1:8082 TAG=before node scripts/audit-shots.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const tag = process.env.TAG || "after";
const out = process.env.OUT || "/workspace/audit-nov14/shots";
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
mkdirSync(out, { recursive: true });
const me = fixtures.me;
const media = (name) => `https://fixture.supabase.co/storage/v1/object/public/media/${name}`;
const now = new Date().toISOString();
const profile = { id: me, user_id: me, display_name: "Maya Cole", avatar_url: null, city: "Charlotte", city_display: "Charlotte, NC", bio: "Photographer and set designer.", onboarding_completed: true, access_status: "active", created_at: "2026-10-01T00:00:00Z" };
const posts = [
  { id: "00000000-0000-4000-8000-000000000811", user_id: me, content: "Set build, day two", media_url: media("clip.mp4"), media_type: "video", post_type: "regular", created_at: now, thumbnail_url: null },
  { id: "00000000-0000-4000-8000-000000000812", user_id: me, content: "Test print", media_url: media("product.jpg"), media_type: "photo", post_type: "regular", created_at: now },
];
const stores = [
  { id: "00000000-0000-4000-8000-000000000a01", user_id: me, name: "Studio Rae", description: "Prints and set pieces", is_active: true, cover_image_url: null, logo_url: null, shopify_store_url: null },
  { id: "00000000-0000-4000-8000-000000000a02", user_id: me, name: "NuanceByLcove", description: "clothing", is_active: true, cover_image_url: media("product.jpg"), logo_url: null, shopify_store_url: null },
];
const items = [1, 2, 3].map((i) => ({ id: `00000000-0000-4000-8000-000000000b0${i}`, store_id: stores[0].id, images: [media("product.jpg") + `?v=${i}`], title: `Print ${i}`, price: 40, is_active: true, created_at: now }));

const scenes = [
  { name: "profile", path: "/profile", widths: [390] },
  { name: "explore-mall", path: "/explore?section=mall", widths: [390, 1280] },
  { name: "explore-for-you", path: "/explore", widths: [390], full: true },
  { name: "create-video", path: "/feed", widths: [390], run: async (page) => {
    await page.getByRole("button", { name: /create/i }).last().click();
    await page.getByRole("button", { name: /^post$/i }).first().click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /choose a video/i }).click();
    await (await chooser).setFiles("/workspace/audit-nov14/fixtures/clip.mp4");
    await page.waitForTimeout(1500);
  } },
];

const browser = await chromium.launch({ channel: "chrome" });
for (const scene of scenes) {
  if (only && !only.includes(scene.name)) continue;
  for (const width of scene.widths) {
    const context = await browser.newContext({ colorScheme: "dark", viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600, isMobile: width < 600 });
    await signedIn(context);
    const page = await context.newPage();
    await mockSupabase(page, {
      profiles: () => ({ body: [profile] }),
      profiles_public: () => ({ body: [profile] }),
      posts: (req) => (req.method() === "GET" ? { body: posts } : null),
      stores: () => ({ body: stores }),
      store_items: () => ({ body: items }),
    });
    await page.route("**/storage/v1/object/public/media/**", (route) => {
      const name = new URL(route.request().url()).pathname.split("/").pop();
      const type = name.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
      route.fulfill({ status: 200, headers: { "content-type": type, "access-control-allow-origin": "*", "accept-ranges": "bytes" }, body: readFileSync(`/workspace/audit-nov14/fixtures/${name}`) });
    });
    try {
      await page.goto(root + scene.path, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(Number(process.env.WAIT || 1200));
      if (scene.run) await scene.run(page);
      await page.screenshot({ path: `${out}/${scene.name}-${width}-${tag}.png`, fullPage: Boolean(scene.full) });
      console.log("shot", scene.name, width, tag);
    } catch (error) {
      console.log("FAILED", scene.name, width, tag, String(error).slice(0, 200));
    }
    await context.close();
  }
}
await browser.close();
