import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve } from "path";

const base = process.env.SHOT_BASE || "http://127.0.0.1:8080";
const outDir = resolve(process.argv[2] || "/opt/cursor/artifacts/iphone-safari");
mkdirSync(outDir, { recursive: true });

const SHOT_USER = "00000000-0000-4000-8000-0000000000aa";
const now = new Date().toISOString();
const musicProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: SHOT_USER,
  display_name: "Maya Torres",
  spotify_artist_url: null,
  apple_music_artist_url: null,
  artist_image_url: null,
  genres: [],
  top_tracks: [],
  albums: [],
  latest_release: null,
  platform_links: [{ platform: "spotify", url: "https://open.spotify.com/artist/maya" }],
  created_at: now,
  updated_at: now,
};

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
    "access-control-expose-headers": "content-range",
    "content-type": "application/json",
    ...extra,
  };
}

async function fulfill(route, body, status = 200) {
  const method = route.request().method();
  await route.fulfill({
    status,
    headers: corsHeaders(),
    body: method === "HEAD" ? "" : JSON.stringify(body),
  });
}

async function mockSupabase(page) {
  await page.route("**/*supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (url.pathname.includes("/rpc/preview_waitlist_invite")) {
      await fulfill(route, "maya@ether.test");
      return;
    }
    if (url.pathname.includes("/auth/v1/")) {
      await fulfill(route, { message: "no session" }, 401);
      return;
    }
    if (url.pathname.includes("/realtime") || url.pathname.includes("/storage/")) {
      await route.abort();
      return;
    }
    if (url.pathname.includes("/music_profiles")) {
      const accept = request.headers().accept || "";
      await fulfill(route, accept.includes("vnd.pgrst.object") ? musicProfile : [musicProfile]);
      return;
    }
    await fulfill(route, []);
  });
}

async function shotContext(browser, extra = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  await context.addInitScript((userId) => {
    localStorage.setItem("ether-shot-user", "1");
    localStorage.setItem(`welcome_shown_${userId}`, "true");
  }, extra.onboarding ? SHOT_USER : SHOT_USER);
  if (extra.onboarding) {
    await context.addInitScript(() => {
      localStorage.setItem("ether-shot-onboarding", "1");
    });
  }
  const page = await context.newPage();
  await mockSupabase(page);
  page.setDefaultTimeout(15000);
  return { context, page };
}

async function assertNoTools(page) {
  const text = await page.locator("body").innerText();
  for (const banned of ["CapCut", "DaVinci", "Premiere", "Final Cut", "What tools", "software do you use"]) {
    if (text.toLowerCase().includes(banned.toLowerCase())) {
      throw new Error(`signup still asks about tools: ${banned}`);
    }
  }
}

const browser = await chromium.launch();
const failures = [];

async function capture(name, fn) {
  try {
    await fn(name);
    console.log(`ok ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`fail ${name}`, error);
  }
}

await capture("friends-back", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/feed`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText(/Friends \(2\)/).waitFor();
  await dialog.getByPlaceholder("Search friends...").waitFor();
  await dialog.getByText("Jordan Reyes").waitFor();
  await dialog.getByRole("button", { name: "Back", exact: true }).waitFor();
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await context.close();
});

await capture("directory-back", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/directory`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Directory" }).waitFor();
  await page.getByRole("button", { name: "Go back" }).waitFor();
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("quests-back", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/quests`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Back", exact: true }).waitFor();
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("collectives-back", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/collectives`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Collectives" }).waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).waitFor();
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("brand-partners-back", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/brand-partners`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Brand Partners" }).waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).waitFor();
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("share-sheet", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/feed`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Share", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("link", { name: "Text message" }).waitFor();
  await dialog.getByRole("button", { name: "Share", exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Copy link" }).waitFor();
  const href = await dialog.getByRole("link", { name: "Text message" }).getAttribute("href");
  if (!href || !href.startsWith("sms:?&body=")) throw new Error(`text link was ${href}`);
  if (!decodeURIComponent(href).includes("etherbylcove.com")) throw new Error(`text link missing url ${href}`);
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("audio-upload", async (name) => {
  const { context, page } = await shotContext(browser);
  await page.goto(`${base}/profile`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Exclusive Music" }).waitFor();
  await page.getByRole("button", { name: "Upload" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Click to select MP3, WAV, FLAC, etc.").waitFor();
  const accept = await dialog.locator("#exclusive-audio-file").getAttribute("accept");
  if (!accept) throw new Error("audio input has no accept");
  if (accept.split(",").includes("audio/*")) throw new Error(`accept still has audio/*: ${accept}`);
  for (const token of [".mp3", ".wav", ".flac", ".m4a", ".aac", "audio/mpeg", "audio/mp4"]) {
    if (!accept.includes(token)) throw new Error(`accept missing ${token}: ${accept}`);
  }
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("signup", async (name) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await mockSupabase(page);
  page.setDefaultTimeout(15000);
  await page.goto(`${base}/auth?invite=shot-invite`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Your name *").waitFor();
  await page.getByPlaceholder("Email *").waitFor();
  await page.getByPlaceholder("Phone number (optional)").waitFor();
  await page.getByPlaceholder("Password *").waitFor();
  await assertNoTools(page);
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await context.close();
});

await capture("onboarding", async (name) => {
  const { context, page } = await shotContext(browser, { onboarding: true });
  await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" });
  await page.getByText("Step 1 of 4").waitFor();
  await page.getByRole("heading", { name: "What's your name?" }).waitFor();
  await assertNoTools(page);
  await page.screenshot({ path: resolve(outDir, `${name}-name.png`) });
  await page.getByLabel("Display Name").fill("Maya Torres");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 2 of 4").waitFor();
  await page.getByRole("heading", { name: "What are you passionate about?" }).waitFor();
  await assertNoTools(page);
  await page.screenshot({ path: resolve(outDir, `${name}-passion.png`) });
  await page.getByPlaceholder("Type a passion, then Enter or comma").fill("Music");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 3 of 4").waitFor();
  await page.getByRole("button", { name: "Los Angeles" }).click();
  await page.getByText("Selected: Los Angeles, CA").waitFor();
  await page.screenshot({ path: resolve(outDir, `${name}-city.png`) });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Mindset Alignment" }).waitFor();
  await page.getByRole("button", { name: "Start questions" }).waitFor();
  await assertNoTools(page);
  await page.screenshot({ path: resolve(outDir, `${name}-questionnaire.png`) });
  await page.getByRole("button", { name: "Start questions" }).click();
  await page.getByText(/Question 1 of/).waitFor();
  await assertNoTools(page);
  await page.screenshot({ path: resolve(outDir, `${name}-question.png`) });
  await context.close();
});

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
