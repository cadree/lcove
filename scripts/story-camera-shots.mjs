/**
 * Story composer shots and a staging post/view pass.
 * 390x844 and 320-wide, Chromium fake camera.
 *
 * Usage:
 *   BASE=http://127.0.0.1:4173 OUT=/workspace/ether-audit/story-camera-nov23/shots \
 *   node scripts/story-camera-shots.mjs
 *
 * Does not print secrets. Blocks production Supabase.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = process.env.OUT ?? "/workspace/ether-audit/story-camera-nov23/shots";
const EMAIL = process.env.EMAIL ?? "ada@staging.ether.test";
const PROD_REF = "aykopqinnnssxdhxqruo";
const STAGING_REF = "vjdrihmriufkameqngfg";
const TEXT = process.env.STORY_TEXT ?? `On set ${Date.now()}`;

const keys = JSON.parse(fs.readFileSync("/workspace/secrets/ether-staging-keys.json", "utf8"));
const password = fs.readFileSync("/workspace/secrets/ether-staging-seed-password.txt", "utf8").trim();
const url = String(keys.url || "");
const projectRef = String(keys.project_ref || STAGING_REF);
const anon = keys.publishable_key || keys.anon_key;
if (!url.includes(STAGING_REF) || projectRef !== STAGING_REF) {
  throw new Error("Staging keys do not point at the staging project.");
}

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password }),
});
if (!login.ok) throw new Error(`Staging sign-in failed (${login.status})`);
const session = await login.json();
const userId = session.user?.id;
if (!session.access_token || !userId) throw new Error("Staging sign-in returned no session.");
const storageKey = `sb-${projectRef}-auth-token`;
const stored = JSON.stringify({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_in: session.expires_in,
  expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
  token_type: "bearer",
  user: session.user,
});

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const viewports = [
  { name: "390", width: 390, height: 844, top: 47, bottom: 34 },
  { name: "320", width: 320, height: 844, top: 47, bottom: 34 },
];

const errors = [];

async function openSignedInPage(viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  });
  await context.addInitScript(
    ({ storageKey, stored, userId, getApp, cardIntro }) => {
      if (!sessionStorage.getItem("story-camera-seeded")) {
        localStorage.setItem(storageKey, stored);
        sessionStorage.setItem("story-camera-seeded", "1");
      }
      localStorage.setItem(getApp, "1");
      localStorage.setItem(cardIntro, "1");
      localStorage.setItem(`welcome_shown_${userId}`, "true");
    },
    {
      storageKey,
      stored,
      userId,
      getApp: "ether:get-the-app-dismissed",
      cardIntro: `ether:card-intro:${userId}`,
    },
  );
  await context.route(`**/${PROD_REF}.supabase.co/**`, (route) => {
    errors.push("production request blocked");
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  page.on("pageerror", (error) => errors.push(String(error.message || error).slice(0, 200)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: viewport.top, bottom: viewport.bottom, left: 0, right: 0 },
  });
  return { context, page };
}

async function openComposer(page) {
  await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Create" }).first().click();
  await page.getByRole("button", { name: "Story", exact: true }).click();
  await page.locator("[data-story-composer]").waitFor({ state: "visible" });
}

async function shot(page, name) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, animations: "disabled" });
  return dest;
}

for (const viewport of viewports) {
  const { context, page } = await openSignedInPage(viewport);
  try {
    await openComposer(page);
    const camera = page.locator('[data-story-stage="camera"]');
    const fallback = page.locator('[data-story-stage="fallback"]');
    await Promise.race([
      camera.waitFor({ state: "visible", timeout: 15000 }),
      fallback.waitFor({ state: "visible", timeout: 15000 }),
    ]);
    if (await fallback.isVisible().catch(() => false)) {
      throw new Error(`Camera fallback on ${viewport.name}: ${await fallback.innerText()}`);
    }
    await page.waitForTimeout(800);
    await shot(page, `${viewport.name}-camera`);

    await page.locator("[data-story-shutter]").click();
    await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 15000 });
    await page.locator("[data-story-add-text]").click();
    const input = page.locator("[data-story-text-input]");
    await input.waitFor({ state: "visible" });
    await input.fill(TEXT);
    await page.locator("[data-story-text-done]").click();
    await page.locator("[data-story-pill]").click();
    await page.locator("[data-story-share]").waitFor({ state: "visible" });
    await shot(page, `${viewport.name}-editor`);

    await page.locator("[data-story-share]").click();
    await page.locator("[data-story-composer]").waitFor({ state: "hidden", timeout: 20000 });
    const yours = page.getByRole("button", { name: "Your story" }).first();
    await yours.waitFor({ state: "visible", timeout: 20000 });
    // Burned-in words live in the image pixels, not the DOM.
    await yours.click();
    const closeStory = page.getByRole("button", { name: "Close story" });
    await closeStory.waitFor({ state: "visible", timeout: 15000 });
    await shot(page, `${viewport.name}-viewer`);

    // Text-only path, no second post on the 320 pass to keep staging quieter.
    if (viewport.name === "390") {
      await closeStory.click();
      await closeStory.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      await openComposer(page);
      await page.locator("[data-story-text]").click();
      await page.locator('[data-story-stage="editor"]').waitFor();
      const textInput = page.locator("[data-story-text-input]");
      await textInput.waitFor();
      await textInput.fill("Words only");
      await page.locator("[data-story-text-done]").click();
      await shot(page, `${viewport.name}-text-only`);
      await page.locator("[data-story-close], [data-story-back]").first().click();
    }

    console.log(`PASS ${viewport.name}`);
  } catch (error) {
    await shot(page, `${viewport.name}-error`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

if (errors.length) {
  console.log("page errors:", errors.slice(0, 8).join(" | "));
}

await browser.close();
console.log(`Wrote shots to ${OUT}`);
