/**
 * Story camera fixes (Nov 23): before/after shots and gesture checks on staging.
 * 390x844 and 320x844, touch emulation, Chromium fake camera.
 *
 * Usage:
 *   MODE=before|after BASE=http://127.0.0.1:4173 \
 *   OUT=/workspace/ether-audit/story-fixes-nov23 node scripts/story-fixes-shots.mjs
 *
 * Does not print secrets. Blocks production Supabase. Deletes the stories it posts.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const MODE = process.env.MODE ?? "after";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = process.env.OUT ?? "/workspace/ether-audit/story-fixes-nov23";
const EMAIL = process.env.EMAIL ?? "ada@staging.ether.test";
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const PROD_REF = "aykopqinnnssxdhxqruo";
const STAGING_REF = "vjdrihmriufkameqngfg";
const CAPTION = "On set tonight";
const KEYBOARD_PX = 336;

const keys = JSON.parse(fs.readFileSync("/workspace/secrets/ether-staging-keys.json", "utf8"));
const password = fs.readFileSync("/workspace/secrets/ether-staging-seed-password.txt", "utf8").trim();
const url = String(keys.url || "");
const projectRef = String(keys.project_ref || STAGING_REF);
const anon = keys.publishable_key || keys.anon_key;
if (!url.includes(STAGING_REF) || projectRef !== STAGING_REF) throw new Error("Staging keys do not point at staging.");

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password }),
});
if (!login.ok) throw new Error(`Staging sign-in failed (${login.status})`);
const session = await login.json();
const userId = session.user?.id;
const startedAt = new Date().toISOString();
const stored = JSON.stringify({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_in: session.expires_in,
  expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
  token_type: "bearer",
  user: session.user,
});
const storageKey = `sb-${projectRef}-auth-token`;
const rest = (p, init = {}) => fetch(`${url}${p}`, {
  ...init,
  headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...(init.headers || {}) },
});

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const viewports = [
  { name: "390", width: 390, height: 844, top: 47, bottom: 34 },
  { name: "320", width: 320, height: 844, top: 47, bottom: 34 },
];
const results = [];
const errors = [];
const log = (line) => { console.log(line); results.push(line); };
const want = (step) => !ONLY.length || ONLY.includes(step);

async function openSignedInPage(viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  });
  await context.addInitScript(({ storageKey, stored, userId }) => {
    if (!sessionStorage.getItem("story-fixes-seeded")) {
      localStorage.setItem(storageKey, stored);
      sessionStorage.setItem("story-fixes-seeded", "1");
    }
    localStorage.setItem("ether:get-the-app-dismissed", "1");
    localStorage.setItem(`ether:card-intro:${userId}`, "1");
    localStorage.setItem(`welcome_shown_${userId}`, "true");
  }, { storageKey, stored, userId });
  await context.route(`**/${PROD_REF}.supabase.co/**`, (route) => { errors.push("production request blocked"); return route.abort(); });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(String(error.message || error).slice(0, 200)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: viewport.top, bottom: viewport.bottom, left: 0, right: 0 } });
  return { context, page, cdp };
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${MODE}-${name}.png`), animations: "disabled" });

async function openCreate(page) {
  await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
  const create = page.getByRole("button", { name: "Create" }).first();
  await create.waitFor({ timeout: 25000 });
  await create.click();
  await page.getByRole("button", { name: "Story", exact: true }).waitFor();
}

async function openComposer(page) {
  await openCreate(page);
  await page.getByRole("button", { name: "Story", exact: true }).click();
  await page.locator("[data-story-composer]").waitFor({ state: "visible" });
  await page.locator('[data-story-stage="camera"]').waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const v = document.querySelector('[data-story-stage="camera"] video');
    return v && v.videoWidth > 0;
  }, null, { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function touch(cdp, type, points) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id, radiusX: 4, radiusY: 4, force: 1 })) });
}

/** Two-finger pinch (gap grows = zoom in) with an optional twist in radians. */
async function pinch(cdp, cx, cy, fromGap, toGap, twist = 0, steps = 10) {
  const at = (gap, angle) => [
    { x: cx - Math.cos(angle) * gap / 2, y: cy - Math.sin(angle) * gap / 2 },
    { x: cx + Math.cos(angle) * gap / 2, y: cy + Math.sin(angle) * gap / 2 },
  ];
  await touch(cdp, "touchStart", at(fromGap, 0));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await touch(cdp, "touchMove", at(fromGap + (toGap - fromGap) * t, twist * t));
  }
  await touch(cdp, "touchEnd", []);
}

async function emulateKeyboard(page, px) {
  await page.evaluate((px) => {
    const vv = window.visualViewport;
    if (!vv) return;
    if (px > 0) {
      const h = window.innerHeight - px;
      Object.defineProperty(vv, "height", { configurable: true, get: () => h });
    } else {
      delete vv.height;
    }
    vv.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
  }, px);
  await page.waitForTimeout(300);
}

async function scrollOffsets(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-story-composer]");
    const list = [];
    for (let el = root; el; el = el.parentElement) list.push(el.scrollTop);
    root?.querySelectorAll("*").forEach((el) => { if (el.scrollTop) list.push(el.scrollTop); });
    return list.reduce((a, b) => a + b, 0);
  });
}

async function setCaption(page, text) {
  const input = page.locator("[data-story-text-input]");
  if (!(await input.isVisible().catch(() => false))) {
    await page.locator("[data-story-overlay]").first().click();
    await input.waitFor({ state: "visible" });
  }
  await input.fill(text);
}

async function bbox(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  return box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : "none";
}

async function cleanupStories() {
  const res = await rest(`/rest/v1/stories?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(startedAt)}&select=id,media_url,media_type`);
  const rows = res.ok ? await res.json() : [];
  for (const row of rows) {
    const match = String(row.media_url || "").match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    if (match) await rest(`/storage/v1/object/media`, { method: "DELETE", body: JSON.stringify({ prefixes: [decodeURIComponent(match[1])] }) });
    await rest(`/rest/v1/stories?id=eq.${row.id}`, { method: "DELETE" });
  }
  log(`cleanup: removed ${rows.length} staging test stories (${rows.map((r) => r.media_type).join(",") || "none"})`);
}

for (const viewport of viewports) {
  const { context, page, cdp } = await openSignedInPage(viewport);
  const vp = viewport.name;
  try {
    if (want("camera")) {
      await openComposer(page);
      const frame = await bbox(page, '[data-story-stage="camera"] video');
      const settings = await page.evaluate(() => {
        const v = document.querySelector('[data-story-stage="camera"] video');
        const t = v?.srcObject?.getVideoTracks?.()[0];
        const s = t?.getSettings?.() ?? {};
        const caps = t?.getCapabilities?.() ?? {};
        return { w: v?.videoWidth, h: v?.videoHeight, zoom: s.zoom ?? null, zoomCap: caps.zoom ?? null };
      });
      log(`${vp} camera: preview box ${frame}, stream ${settings.w}x${settings.h}, zoom ${JSON.stringify(settings.zoom)} cap ${JSON.stringify(settings.zoomCap)}`);
      await shot(page, `${vp}-camera`);

      // Pinch on the preview.
      const vbox = await page.locator('[data-story-stage="camera"] video').boundingBox();
      const before = await page.evaluate(() => ({ zoom: document.querySelector("[data-story-zoom]")?.getAttribute("data-story-zoom") ?? null, page: window.visualViewport?.scale ?? 1 }));
      await pinch(cdp, vbox.x + vbox.width / 2, vbox.y + vbox.height / 2, 60, 220);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ zoom: document.querySelector("[data-story-zoom]")?.getAttribute("data-story-zoom") ?? null, page: window.visualViewport?.scale ?? 1, transform: getComputedStyle(document.querySelector('[data-story-stage="camera"] video')).transform }));
      log(`${vp} camera pinch: zoom ${before.zoom} -> ${after.zoom}; page scale ${before.page} -> ${after.page}; video transform ${after.transform}`);
      await shot(page, `${vp}-camera-pinched`);
      if (MODE === "before") await openComposer(page); // reset the page zoom the pinch caused
      if (MODE === "after") {
        if (!(Number(after.zoom) > 1.5)) throw new Error(`${vp}: pinch did not zoom (${after.zoom})`);
        if (after.page !== 1) throw new Error(`${vp}: page zoomed instead of camera`);
        // Photo respects the zoom: the burned capture should match the preview crop.
        await page.locator("[data-story-shutter]").click();
        await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible" });
        const cap = await page.evaluate(() => window.__storyCaptureInfo ?? null);
        log(`${vp} zoomed photo crop: ${JSON.stringify(cap)}`);
        if (!cap || !(cap.zoom > 1.5)) throw new Error(`${vp}: zoomed photo did not use the zoom`);
        await shot(page, `${vp}-zoomed-photo`);
        await page.locator("[data-story-back]").click();
        await page.locator('[data-story-stage="camera"]').waitFor({ state: "visible" });
        await page.waitForFunction(() => document.querySelector('[data-story-stage="camera"] video')?.videoWidth > 0);
        const reset = await page.evaluate(() => document.querySelector("[data-story-zoom]")?.getAttribute("data-story-zoom"));
        log(`${vp} zoom after returning to camera: ${reset}`);
      }
    }

    if (want("editor")) {
      if (!(await page.locator('[data-story-stage="camera"]').isVisible().catch(() => false))) await openComposer(page);
      await page.locator("[data-story-shutter]").click();
      await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 15000 });
      await page.locator("[data-story-add-text]").click();
      await setCaption(page, CAPTION);
      // Keyboard open, then the Background tool.
      await emulateKeyboard(page, KEYBOARD_PX);
      const pillBox = await bbox(page, "[data-story-pill]");
      const chrome = await page.evaluate(() => {
        const el = document.querySelector("[data-story-pill]")?.closest(".z-10");
        return el ? getComputedStyle(el).paddingBottom : null;
      });
      log(`${vp} keyboard open: Background at ${pillBox}, toolbar paddingBottom ${chrome}, scroll offset ${await scrollOffsets(page)}`);
      await shot(page, `${vp}-editor-keyboard`);
      const focusedBefore = await page.evaluate(() => document.activeElement?.hasAttribute("data-story-text-input") ?? false);
      // Real-phone order: pointerdown/mousedown can blur the field before click.
      const pill = page.locator("[data-story-pill]");
      const box = await pill.boundingBox();
      await touch(cdp, "touchStart", [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }]);
      await touch(cdp, "touchEnd", []);
      await page.waitForTimeout(500);
      const composerOpen = await page.locator("[data-story-composer]").isVisible().catch(() => false);
      const stage = await page.locator("[data-story-stage]").first().getAttribute("data-story-stage").catch(() => null);
      const pressed = await page.locator("[data-story-pill]").getAttribute("aria-pressed").catch(() => null);
      const focusedAfter = await page.evaluate(() => document.activeElement?.hasAttribute("data-story-text-input") ?? false);
      log(`${vp} Background tap with keyboard: composer open=${composerOpen}, stage=${stage}, pill=${pressed}, field focused ${focusedBefore}->${focusedAfter}, scroll offset ${await scrollOffsets(page)}`);
      await shot(page, `${vp}-background-tool`);
      await emulateKeyboard(page, 0);
      if (MODE === "after" && (!composerOpen || stage !== "editor" || pressed !== "true")) throw new Error(`${vp}: Background tool broke the editor`);
      if (composerOpen && (await page.locator("[data-story-text-done]").isVisible().catch(() => false))) {
        await page.locator("[data-story-text-done]").click();
      }
      if (MODE === "after") {
        // Pinch and twist the caption with two fingers.
        const overlay = page.locator("[data-story-overlay]").first();
        const ob = await overlay.boundingBox();
        await pinch(cdp, ob.x + ob.width / 2, ob.y + ob.height / 2, 40, 110, 0.3);
        await page.waitForTimeout(300);
        // Drag it lower with one finger.
        const ob2 = await overlay.boundingBox();
        const sx = ob2.x + ob2.width / 2;
        const sy = ob2.y + ob2.height / 2;
        await touch(cdp, "touchStart", [{ x: sx, y: sy }]);
        for (let i = 1; i <= 6; i += 1) await touch(cdp, "touchMove", [{ x: sx, y: sy + i * 15 }]);
        await touch(cdp, "touchEnd", []);
        await page.waitForTimeout(300);
        const state = await page.evaluate(() => window.__storyWysiwyg?.overlays?.[0] ?? null);
        log(`${vp} caption after pinch/drag: scale ${state?.scale?.toFixed?.(2)} rotation ${state?.rotation?.toFixed?.(2)} y ${state?.y?.toFixed?.(3)}`);
        if (!(state?.scale > 1.6)) throw new Error(`${vp}: caption pinch did not scale`);
        await shot(page, `${vp}-editor-resized-caption`);
        // WYSIWYG: burn the JPEG and compare text pixels with the editor preview canvas.
        const cmp = await page.evaluate(async () => {
          const hook = window.__storyWysiwyg;
          await hook.waitForStoryFonts();
          const bright = (data, w, h) => {
            let minX = w; let minY = h; let maxX = -1; let maxY = -1;
            for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
              const i = (y * w + x) * 4;
              if (data[i + 3] > 128 && data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) {
                if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
              }
            }
            return maxX < 0 ? null : { x: minX / w, y: minY / h, w: (maxX - minX) / w, h: (maxY - minY) / h };
          };
          const burned = await hook.burnStoryImage({ image: null, background: "#000000", overlays: hook.overlays, waitForFonts: hook.waitForStoryFonts });
          const img = await createImageBitmap(burned);
          const c = document.createElement("canvas");
          c.width = img.width; c.height = img.height;
          const cx = c.getContext("2d");
          cx.drawImage(img, 0, 0);
          const b = bright(cx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          const prev = document.querySelector("[data-story-preview-canvas]");
          const p = bright(prev.getContext("2d").getImageData(0, 0, prev.width, prev.height).data, prev.width, prev.height);
          return { burned: b, editor: p };
        });
        const diff = cmp.burned && cmp.editor ? Math.max(...["x", "y", "w", "h"].map((k) => Math.abs(cmp.burned[k] - cmp.editor[k]))) : 1;
        log(`${vp} WYSIWYG scaled caption: burned ${JSON.stringify(cmp.burned)} editor ${JSON.stringify(cmp.editor)} max diff ${diff.toFixed(4)}`);
        if (diff > 0.01) throw new Error(`${vp}: burned caption differs from editor (${diff})`);
      }
      await page.locator("[data-story-back]").click();
    }

    if (MODE === "after" && want("record")) {
      if (!(await page.locator('[data-story-stage="camera"]').isVisible().catch(() => false))) await openComposer(page);
      await page.waitForFunction(() => document.querySelector('[data-story-stage="camera"] video')?.videoWidth > 0);
      const shutter = page.locator("[data-story-shutter]");
      const sb = await shutter.boundingBox();
      await touch(cdp, "touchStart", [{ x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }]);
      await page.locator('[data-story-recording="true"]').waitFor({ timeout: 5000 });
      await page.waitForTimeout(1800);
      const ring = await page.evaluate(() => document.querySelector("[data-story-record-progress]")?.getAttribute("data-story-record-progress"));
      log(`${vp} recording: progress ${ring}`);
      await shot(page, `${vp}-recording`);
      await page.waitForTimeout(700);
      await touch(cdp, "touchEnd", []);
      await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 15000 });
      const clip = await page.evaluate(() => window.__storyRecordingInfo ?? null);
      log(`${vp} recorded clip: ${JSON.stringify(clip)}`);
      if (!clip || !(clip.size > 0)) throw new Error(`${vp}: no recorded clip`);
      await page.waitForFunction(() => {
        const v = document.querySelector('[data-story-stage="editor"] video');
        return v && v.readyState >= 2;
      }, null, { timeout: 15000 });
      await shot(page, `${vp}-video-preview`);
      await page.locator("[data-story-add-text]").click();
      await setCaption(page, "Rolling");
      await page.locator("[data-story-text-done]").click();
      await shot(page, `${vp}-video-text`);
      if (vp === "390") {
        await page.locator("[data-story-share]").click();
        await page.locator("[data-story-composer]").waitFor({ state: "hidden", timeout: 120000 });
        // Wait for the background upload to create the row.
        let row = null;
        for (let i = 0; i < 60 && !row; i += 1) {
          const res = await rest(`/rest/v1/stories?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(startedAt)}&media_type=eq.video&select=id,media_url,media_type`);
          const rows = res.ok ? await res.json() : [];
          row = rows[0] ?? null;
          if (!row) await page.waitForTimeout(1000);
        }
        if (!row) throw new Error("video story row never appeared");
        const head = await fetch(row.media_url, { method: "HEAD" });
        log(`${vp} shared video story: ${head.status} ${head.headers.get("content-type")} ${head.headers.get("content-length")} bytes`);
        const yours = page.getByRole("button", { name: "Your story" }).first();
        await yours.waitFor({ state: "visible", timeout: 20000 });
        await yours.click();
        await page.getByRole("button", { name: "Close story" }).waitFor({ timeout: 15000 });
        await page.waitForTimeout(1500);
        await shot(page, `${vp}-video-story-viewer`);
        await page.getByRole("button", { name: "Close story" }).click();
      } else {
        await page.locator("[data-story-back]").click();
      }
    }

    if (want("create")) {
      await page.keyboard.press("Escape").catch(() => {});
      await openCreate(page);
      await page.waitForTimeout(500);
      const cinema = await page.getByRole("button", { name: /cinema/i }).count();
      log(`${vp} Create sheet: Cinema buttons ${cinema}`);
      await shot(page, `${vp}-create-sheet`);
      if (MODE === "after" && cinema) throw new Error(`${vp}: Cinema still in Create sheet`);
      // Pressed state on a Create tile.
      const tile = page.getByRole("button", { name: "Post", exact: true });
      const tb = await tile.boundingBox();
      await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(250);
      const style = await tile.evaluate((el) => { const s = getComputedStyle(el); return `scale=${s.scale} transform=${s.transform} filter=${s.filter}`; });
      log(`${vp} pressed Post tile: ${style}`);
      await shot(page, `${vp}-pressed-create-tile`);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.keyboard.press("Escape").catch(() => {});
    }

    if (want("routes")) {
      for (const p of ["/cinema", "/cinema/network/abc", "/cinema/manage/abc"]) {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2500);
        log(`${vp} ${p} -> ${new URL(page.url()).pathname}`);
      }
      await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const links = await page.locator('a[href^="/cinema"]').count();
      const chip = await page.getByText("Cinema", { exact: true }).count();
      log(`${vp} explore: cinema links ${links}, Cinema text ${chip}`);
      if (MODE === "after" && (links || chip)) throw new Error(`${vp}: Explore still links Cinema`);
    }

    if (want("reels")) {
      await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
      const seeAll = page.getByRole("button", { name: "See all" });
      await seeAll.waitFor({ timeout: 20000 }).catch(() => {});
      if (await seeAll.isVisible().catch(() => false)) await seeAll.click();
      const reelsLane = page.getByRole("button", { name: /^reels$/i }).first();
      if (await reelsLane.isVisible().catch(() => false)) await reelsLane.click();
      const tile = page.locator('[data-testid="reel-tile"], button:has(video), button:has(img)').first();
      await page.waitForTimeout(2000);
      const opened = await page.evaluate(() => {
        const t = [...document.querySelectorAll("section[aria-label='Browse'] .grid button")][0];
        if (!t) return false;
        t.click();
        return true;
      });
      void tile;
      if (opened) {
        const scroller = page.getByTestId("reel-scroller");
        await scroller.waitFor({ timeout: 10000 });
        await scroller.evaluate((el) => { el.style.scrollSnapType = "none"; el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(800);
        const btn = page.getByRole("button", { name: "Back to Explore" });
        const bb = await btn.boundingBox();
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(250);
        const style = await btn.evaluate((el) => { const s = getComputedStyle(el); return `scale=${s.scale} filter=${s.filter}`; });
        log(`${vp} pressed Back to Explore: ${style}`);
        await shot(page, `${vp}-pressed-reels-end`);
        await page.mouse.move(0, 0);
        await page.mouse.up();
      } else {
        log(`${vp} reels: no reel tile on staging to open`);
      }
    }
    log(`PASS ${vp}`);
  } catch (error) {
    await shot(page, `${vp}-error`).catch(() => {});
    log(`FAIL ${vp}: ${String(error?.message || error).slice(0, 300)}`);
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

await cleanupStories().catch((e) => log(`cleanup failed: ${e.message}`));
if (errors.length) log(`page errors: ${[...new Set(errors)].slice(0, 8).join(" | ")}`);
fs.writeFileSync(path.join(OUT, `${MODE}-results.txt`), results.join("\n") + "\n");
await browser.close();
