/**
 * Story camera shutter check (Nov 23): tap = photo, hold = video, with touch input.
 * ENGINE=chromium (Chrome fake camera, CDP touch) or ENGINE=webkit (Playwright WebKit,
 * touch taps, canvas-backed camera because Linux WebKit has no capture devices).
 *
 *   ENGINE=webkit MODE=after BASE=http://127.0.0.1:4180 \
 *   OUT=/workspace/ether-audit/shutter-nov23 node scripts/story-shutter-check.mjs
 *
 * Staging only. Posts nothing.
 */
import { chromium, webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENGINE = process.env.ENGINE ?? "chromium";
const MODE = process.env.MODE ?? "after";
const BASE = process.env.BASE ?? "http://127.0.0.1:4180";
const OUT = process.env.OUT ?? "/workspace/ether-audit/shutter-nov23";
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
const stored = JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: session.user });
fs.mkdirSync(OUT, { recursive: true });

const browser = ENGINE === "webkit"
  ? await webkit.launch()
  : await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });

const results = [];
let failed = 0;
const log = (line) => { console.log(line); results.push(line); };

for (const vp of (process.env.VPS ?? "390,320").split(",").map(Number)) {
  const context = await browser.newContext({
    viewport: { width: vp, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  });
  await context.addInitScript(({ k, v, uid, engine }) => {
    if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); }
    localStorage.setItem("ether:get-the-app-dismissed", "1");
    localStorage.setItem(`ether:card-intro:${uid}`, "1");
    localStorage.setItem(`welcome_shown_${uid}`, "true");
    // Every pointer and touch event that reaches the shutter, in order.
    window.__shutterEvents = [];
    const note = (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-story-shutter]") : null;
      if (el) window.__shutterEvents.push(`${e.type}${e.pointerType ? `:${e.pointerType}` : ""}`);
    };
    for (const type of ["pointerdown", "pointerup", "pointercancel", "touchstart", "touchend", "touchcancel", "click", "contextmenu"]) {
      document.addEventListener(type, note, { capture: true, passive: true });
    }
    if (engine === "webkit") {
      // Linux WebKit has no camera and crashes on canvas streams in <video>: hand the
      // composer a stand-in stream and a video element that reports a 720x1280 frame.
      const track = {
        kind: "video", label: "fake", readyState: "live", enabled: true, muted: false,
        stop() {}, getSettings: () => ({ width: 720, height: 1280, facingMode: "environment" }),
        getCapabilities: () => ({}), getConstraints: () => ({}), applyConstraints: async () => {},
        addEventListener() {}, removeEventListener() {},
      };
      const stream = { getVideoTracks: () => [track], getAudioTracks: () => [], getTracks: () => [track], active: true };
      const proto = HTMLMediaElement.prototype;
      const srcObject = Object.getOwnPropertyDescriptor(proto, "srcObject");
      Object.defineProperty(proto, "srcObject", { configurable: true,
        get() { return this.__fakeSrc ?? srcObject.get.call(this); },
        set(v) { if (v === stream) { this.__fakeSrc = v; return; } this.__fakeSrc = undefined; srcObject.set.call(this, v); } });
      const play = proto.play;
      proto.play = function () { return this.__fakeSrc ? Promise.resolve() : play.call(this); };
      for (const [key, value] of [["videoWidth", 720], ["videoHeight", 1280]]) {
        const d = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, key);
        Object.defineProperty(HTMLVideoElement.prototype, key, { configurable: true, get() { return this.__fakeSrc ? value : d.get.call(this); } });
      }
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
        getUserMedia: async (c) => { if (c && c.video) return stream; throw new DOMException("no mic", "NotFoundError"); },
        enumerateDevices: async () => [{ kind: "videoinput", deviceId: "fake", label: "fake", groupId: "g" }],
        addEventListener() {}, removeEventListener() {},
      } });
    }
  }, { k: `sb-${STAGING_REF}-auth-token`, v: stored, uid: userId, engine: ENGINE });
  await context.route("**/aykopqinnnssxdhxqruo.supabase.co/**", (r) => r.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  const cdp = ENGINE === "chromium" ? await context.newCDPSession(page) : null;
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${MODE}-${ENGINE}-${vp}-${name}.png`) });
  const touchAt = async (type, x, y) => {
    if (cdp) {
      await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    }
  };
  const openComposer = async () => {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Create" }).first().tap();
    await page.getByRole("button", { name: "Story", exact: true }).tap();
    await page.locator('[data-story-stage="camera"]').waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('[data-story-stage="camera"] video')?.videoWidth > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector("[data-story-shutter]")?.disabled, null, { timeout: 15000 });
    await page.waitForTimeout(400);
  };
  const reset = () => page.evaluate(() => { window.__shutterEvents = []; });
  const events = () => page.evaluate(() => window.__shutterEvents.join(" "));
  const toasts = () => page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
  const step = async (name, fn) => {
    try { await fn(); log(`${ENGINE} ${vp} PASS ${name}`); }
    catch (e) { failed += 1; log(`${ENGINE} ${vp} FAIL ${name}: ${String(e.message).split("\n")[0].slice(0, 200)}`); await shot(`fail-${name.replace(/\W+/g, "-")}`).catch(() => {}); }
  };

  await step("tap takes a photo", async () => {
    await openComposer();
    await shot("camera");
    await reset();
    const box = await page.locator("[data-story-shutter]").boundingBox();
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    if (cdp) { await touchAt("touchStart", x, y); await page.waitForTimeout(90); await touchAt("touchEnd"); }
    else await page.touchscreen.tap(x, y);
    const ok = await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
    log(`${ENGINE} ${vp} tap events: ${await events()}; toasts: ${JSON.stringify(await toasts())}`);
    if (!ok) throw new Error("tap did not open the editor with a photo");
    await shot("after-tap-photo");
  });

  await step(cdp ? "hold records a video" : "hold without a recorder shows a note, then tap still takes a photo", async () => {
    if (!(await page.locator('[data-story-stage="camera"]').isVisible().catch(() => false))) await openComposer();
    await reset();
    const box = await page.locator("[data-story-shutter]").boundingBox();
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    if (cdp) {
      await touchAt("touchStart", x, y);
      await page.locator('[data-story-recording="true"]').waitFor({ timeout: 4000 });
      await page.waitForTimeout(1500);
      await shot("recording");
      await touchAt("touchEnd");
      await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 10000 });
      const clip = await page.evaluate(() => window.__storyRecordingInfo ?? null);
      log(`${ENGINE} ${vp} hold events: ${await events()}; clip ${JSON.stringify(clip)}`);
      if (!clip || !(clip.size > 0)) throw new Error("no clip");
      await shot("after-hold-video");
    } else {
      // Playwright WebKit can tap but not hold a touch, and this Linux build has no
      // MediaRecorder: hold with the mouse, expect the "not available" note, then a tap
      // must still take a photo.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(1200);
      await shot("holding");
      await page.mouse.up();
      await page.waitForTimeout(400);
      const notes = await toasts();
      const stillCamera = await page.locator('[data-story-stage="camera"]').isVisible();
      log(`${ENGINE} ${vp} hold events: ${await events()}; toasts: ${JSON.stringify(notes)}; MediaRecorder ${await page.evaluate(() => typeof MediaRecorder)}; still on camera ${stillCamera}`);
      if (!stillCamera) throw new Error("a hold without a recorder left the camera");
      await reset();
      const again = await page.locator("[data-story-shutter]").boundingBox();
      await page.touchscreen.tap(again.x + again.width / 2, again.y + again.height / 2);
      const ok = await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
      log(`${ENGINE} ${vp} tap after hold events: ${await events()}`);
      if (!ok) throw new Error("tap after a hold did not take a photo");
      await shot("tap-after-hold");
    }
  });

  if (cdp) {
    // iOS can end a tap with touchcancel/pointercancel when its own gestures claim the
    // touch. That must still be a photo.
    await step("tap ended by a cancel still takes a photo", async () => {
      await openComposer();
      await reset();
      const box = await page.locator("[data-story-shutter]").boundingBox();
      await touchAt("touchStart", box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(90);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      const ok = await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
      log(`${ENGINE} ${vp} cancelled-tap events: ${await events()}`);
      if (!ok) throw new Error("a tap that ended in a cancel did nothing");
    });
    // A hold that iOS cancels mid-recording keeps the clip instead of dropping it.
    await step("hold ended by a cancel keeps the clip", async () => {
      await openComposer();
      await page.evaluate(() => { window.__storyRecordingInfo = null; });
      const box = await page.locator("[data-story-shutter]").boundingBox();
      await touchAt("touchStart", box.x + box.width / 2, box.y + box.height / 2);
      await page.locator('[data-story-recording="true"]').waitFor({ timeout: 4000 });
      await page.waitForTimeout(1500);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      const ok = await page.locator('[data-story-stage="editor"]').waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
      const clip = await page.evaluate(() => window.__storyRecordingInfo ?? null);
      log(`${ENGINE} ${vp} cancelled-hold clip: ${JSON.stringify(clip)}`);
      if (!ok || !clip) throw new Error("a hold that ended in a cancel lost the clip");
    });
  }
  if (errors.length) log(`${ENGINE} ${vp} page errors: ${errors.join(" | ")}`);
  await context.close();
}
fs.writeFileSync(path.join(OUT, `${MODE}-${ENGINE}-results.txt`), results.join("\n") + "\n");
await browser.close();
process.exit(failed ? 1 : 0);
