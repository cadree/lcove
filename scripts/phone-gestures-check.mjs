// Phone gesture check: real multi-touch (CDP Input.dispatchTouchEvent) at 390x844, touch + mobile.
// Every gesture runs ROUNDS times (default 20) with seeded jitter in finger positions and timing,
// and the script prints a success rate per gesture. Run it every round:
//   ROOT=http://127.0.0.1:8081 node scripts/phone-gestures-check.mjs
// Options: ROUNDS=20 SEED=7 ONLY=globe-pinch,pipeline-hold-drag OUT=/tmp/phone-gestures STRICT=1
// STRICT=1 exits non-zero unless every gesture is 100%.
// cspell:words longtask networkidle filechooser roledescription
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const out = process.env.OUT || "/tmp/phone-gestures";
const ROUNDS = Number(process.env.ROUNDS || 20);
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
mkdirSync(out, { recursive: true });

// Seeded random numbers so a failing round can be replayed.
let seed = Number(process.env.SEED || 7) >>> 0;
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + (b - a) * rand();
const jitter = (n) => between(-n, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fixtures: 11 members over 5 cities, Charlotte the biggest group.
const me = fixtures.me;
const now = new Date().toISOString();
const cityOf = ["charlotte|nc", "charlotte|nc", "charlotte|nc", "charlotte|nc", "raleigh|nc", "raleigh|nc", "durham|nc", "atlanta|ga", "atlanta|ga", "atlanta|ga", "los angeles|ca"];
const label = { "charlotte|nc": "Charlotte, NC", "raleigh|nc": "Raleigh, NC", "durham|nc": "Durham, NC", "atlanta|ga": "Atlanta, GA", "los angeles|ca": "Los Angeles, CA" };
const members = cityOf.map((key, i) => ({ user_id: `00000000-0000-4000-8000-0000000c${String(i).padStart(4, "0")}`, display_name: `Member ${i + 1}`, avatar_url: null, city: label[key], city_display: label[key], city_key: key, bio: "Director", created_at: now }));
const profile = { id: me, user_id: me, display_name: "Maya Cole", avatar_url: null, city: "Charlotte", city_display: "Charlotte, NC", bio: "", onboarding_completed: true, access_status: "active", created_at: now };
const people = {
  profiles: (req, url) => (url.pathname.endsWith("/profiles_public") && url.searchParams.get("select")?.includes("city_key") ? { body: members } : { body: [profile] }),
  discovery_globe: () => ({ body: members.map((m) => ({ user_id: m.user_id, live_city_key: null, live_until: null, trip: null, liked: null })) }),
  discovery_settings: () => ({ body: { discoverable: true, live_city_key: null } }),
};

const browser = await chromium.launch({ channel: "chrome" });
const results = {};

async function phone(mock = {}) {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await signedIn(context);
  await context.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((list) => window.__long.push(...list.getEntries().map((e) => ({ t: e.startTime, d: e.duration })))).observe({ type: "longtask", buffered: true });
    } catch { /* not supported */ }
    window.__menus = 0;
    window.__menusAllowed = 0;
    addEventListener("contextmenu", (e) => { window.__menus++; setTimeout(() => { if (!e.defaultPrevented) window.__menusAllowed++; }); }, true);
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockSupabase(page, mock);
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchCancel" ? [] : points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
  return { context, page, cdp, touch, errors };
}

/** Frames and long tasks while `fn` runs. */
async function measure(page, fn) {
  await page.evaluate(() => {
    window.__frames = 0;
    window.__run = true;
    window.__t0 = performance.now();
    const tick = () => { if (!window.__run) return; window.__frames++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const value = await fn();
  const perf = await page.evaluate(() => {
    window.__run = false;
    const ms = performance.now() - window.__t0;
    const long = window.__long.filter((e) => e.t >= window.__t0);
    return { fps: Math.round((window.__frames * 1000) / ms), longTasks: long.length, longestMs: Math.round(Math.max(0, ...long.map((e) => e.d))) };
  });
  return { value, perf };
}

async function pageState(page) {
  return page.evaluate(() => ({ scale: window.visualViewport?.scale ?? 1, scrollY: Math.round(scrollY), selection: String(getSelection() || "") }));
}

async function pinch(touch, mid, angle, d0, d1, steps, stepMs) {
  const at = (d) => [
    { x: mid.x - (Math.cos(angle) * d) / 2, y: mid.y - (Math.sin(angle) * d) / 2, id: 1 },
    { x: mid.x + (Math.cos(angle) * d) / 2, y: mid.y + (Math.sin(angle) * d) / 2, id: 2 },
  ];
  // Fingers rarely land together: the first one touches, the second follows a moment later.
  await touch("touchStart", [at(d0)[0]]);
  await sleep(between(8, 40));
  await touch("touchMove", [at(d0)[0]]);
  await touch("touchStart", at(d0));
  for (let i = 1; i <= steps; i++) {
    const d = d0 + ((d1 - d0) * i) / steps;
    const p = at(d).map((f) => ({ ...f, x: f.x + jitter(1.2), y: f.y + jitter(1.2) }));
    await touch("touchMove", p);
    await sleep(stepMs + jitter(4));
  }
}

async function record(name, rounds, fn) {
  if (only && !only.includes(name)) return;
  const runs = [];
  for (let i = 0; i < rounds; i++) {
    let r;
    try {
      r = await fn(i);
    } catch (e) {
      r = { ok: false, why: String(e.message || e).split("\n")[0].slice(0, 160) };
    }
    runs.push(r);
  }
  const ok = runs.filter((r) => r.ok).length;
  const fails = runs.filter((r) => !r.ok).map((r) => r.why);
  const perf = runs.filter((r) => r.perf).map((r) => r.perf);
  const summary = { ok, rounds, fails: [...new Set(fails)].slice(0, 4) };
  if (perf.length) summary.perf = { minFps: Math.min(...perf.map((p) => p.fps)), longTasks: perf.reduce((a, p) => a + p.longTasks, 0), longestMs: Math.max(...perf.map((p) => p.longestMs)) };
  results[name] = { ...summary, runs };
  console.log(`${ok === rounds ? "PASS" : "FAIL"} ${name} ${ok}/${rounds}${summary.perf ? ` minFps=${summary.perf.minFps} longTasks=${summary.perf.longTasks} longest=${summary.perf.longestMs}ms` : ""}${fails.length ? " :: " + summary.fails.join(" | ") : ""}`);
}

// ---------- Globe ----------
async function openGlobe() {
  const s = await phone(people);
  await s.page.goto(root + "/explore?section=people", { waitUntil: "networkidle" });
  const globe = s.page.locator('svg[aria-label^="Globe of members"]');
  await globe.waitFor({ timeout: 15000 });
  await globe.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await sleep(300);
  return { ...s, globe };
}
const globeZoom = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label^="Globe of members"]');
    const sphere = svg.querySelector("path");
    return sphere.getBoundingClientRect().width / ((svg.getBoundingClientRect().width / 400) * 356);
  });
const markerAt = (page, name) =>
  page.evaluate((n) => {
    const el = [...document.querySelectorAll("[data-city-marker]")].find((m) => m.getAttribute("aria-label").startsWith(n));
    if (!el) return null;
    const c = el.querySelector("circle[r='17']") || el;
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, name);

{
  const g = only && !only.some((o) => o.startsWith("globe")) ? null : await openGlobe();
  const reset = async () => {
    await g.page.reload({ waitUntil: "networkidle" });
    await g.globe.waitFor();
    await g.globe.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await sleep(250);
  };
  await record("globe-pinch", ROUNDS, async (i) => {
    if (i) await reset();
    const z0 = await globeZoom(g.page);
    const lead = await markerAt(g.page, "Charlotte");
    if (!lead) return { ok: false, why: "no Charlotte marker" };
    const mid = { x: lead.x + jitter(5), y: lead.y + jitter(5) };
    const before = await pageState(g.page);
    const d0 = between(50, 80);
    const factor = between(1.8, 2.6);
    const { value, perf } = await measure(g.page, async () => {
      await pinch(g.touch, mid, between(0, Math.PI), d0, d0 * factor, Math.round(between(8, 14)), between(10, 22));
      await sleep(60);
      const during = await pageState(g.page);
      const z1 = await globeZoom(g.page);
      const anchor = await markerAt(g.page, "Charlotte");
      await g.touch("touchEnd", []);
      return { during, z1, anchor };
    });
    const ratio = value.z1 / z0;
    const drift = value.anchor ? Math.hypot(value.anchor.x - mid.x, value.anchor.y - mid.y) : Infinity;
    const pageMoved = value.during.scale !== 1 || value.during.scrollY !== before.scrollY;
    const ok = Math.abs(ratio / factor - 1) < 0.15 && drift < 20 && !pageMoved;
    return { ok, why: `zoom x${ratio.toFixed(2)} for fingers x${factor.toFixed(2)}, anchor drift ${drift.toFixed(0)}px${pageMoved ? ", page moved/zoomed" : ""}`, perf, ratio, factor, drift };
  });
  await record("globe-pinch-in", ROUNDS, async (i) => {
    if (i) await reset();
    // Zoom in with the button first, then pinch back out of it.
    await g.page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await g.page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await sleep(200);
    const z0 = await globeZoom(g.page);
    const box = await g.globe.boundingBox();
    const mid = { x: box.x + box.width / 2 + jitter(20), y: box.y + box.height / 2 + jitter(20) };
    const d0 = between(150, 200);
    const factor = between(0.45, 0.7);
    const { value, perf } = await measure(g.page, async () => {
      await pinch(g.touch, mid, between(0, Math.PI), d0, d0 * factor, Math.round(between(8, 14)), between(10, 22));
      await sleep(60);
      const z1 = await globeZoom(g.page);
      const during = await pageState(g.page);
      await g.touch("touchEnd", []);
      return { z1, during };
    });
    const expected = Math.max(1, z0 * factor) / z0;
    const ratio = value.z1 / z0;
    const ok = Math.abs(ratio / expected - 1) < 0.15 && value.during.scale === 1;
    return { ok, why: `zoom x${ratio.toFixed(2)} expected x${expected.toFixed(2)}`, perf };
  });
  await record("globe-pan", ROUNDS, async (i) => {
    if (i) await reset();
    const lead = await markerAt(g.page, "Charlotte");
    const before = await pageState(g.page);
    // Grab Charlotte itself: on an orthographic globe only the grabbed point is guaranteed to stay
    // under the finger; other places move more or less depending on how close to the edge they are.
    const start = { x: lead.x + jitter(10), y: lead.y + jitter(10) };
    const dx = between(-70, 70), dy = between(-50, 50);
    await g.touch("touchStart", [start]);
    for (let s = 1; s <= 10; s++) {
      await g.touch("touchMove", [{ x: start.x + (dx * s) / 10 + jitter(1), y: start.y + (dy * s) / 10 + jitter(1) }]);
      await sleep(between(10, 20));
    }
    await sleep(60);
    const after = await markerAt(g.page, "Charlotte");
    const during = await pageState(g.page);
    await g.touch("touchEnd", []);
    if (!after) return { ok: false, why: "marker went behind the globe" };
    const moved = Math.hypot(after.x - lead.x - dx, after.y - lead.y - dy);
    const ok = moved < 22 && during.scrollY === before.scrollY;
    const trace = process.env.TRACE ? ` start ${start.x.toFixed(0)},${start.y.toFixed(0)} d ${dx.toFixed(0)},${dy.toFixed(0)} lead ${lead.x.toFixed(0)},${lead.y.toFixed(0)} after ${after.x.toFixed(0)},${after.y.toFixed(0)}` : "";
    return { ok, why: `marker off the finger by ${moved.toFixed(0)}px, page scroll ${during.scrollY - before.scrollY}${trace}` };
  });
  await record("globe-double-tap", ROUNDS, async (i) => {
    if (i) await reset();
    const box = await g.globe.boundingBox();
    const at = { x: box.x + box.width * between(0.3, 0.45), y: box.y + box.height * between(0.6, 0.75) };
    const z0 = await globeZoom(g.page);
    for (let k = 0; k < 2; k++) {
      const p = { x: at.x + jitter(4), y: at.y + jitter(4) };
      await g.touch("touchStart", [p]);
      await sleep(between(40, 90));
      await g.touch("touchEnd", []);
      await sleep(between(80, 160));
    }
    await sleep(120);
    const ratio = (await globeZoom(g.page)) / z0;
    return { ok: Math.abs(ratio - 2) < 0.2, why: `double tap zoom x${ratio.toFixed(2)}` };
  });
  await record("globe-marker-tap", ROUNDS, async (i) => {
    if (i) await reset();
    const z0 = await globeZoom(g.page);
    const lead = await markerAt(g.page, "Charlotte");
    const p = { x: lead.x + jitter(3), y: lead.y + jitter(3) };
    await g.touch("touchStart", [p]);
    await sleep(between(50, 140));
    await g.touch("touchMove", [{ x: p.x + jitter(2), y: p.y + jitter(2) }]);
    await g.touch("touchEnd", []);
    await sleep(400);
    const z1 = await globeZoom(g.page);
    const pressed = await g.page.locator('[data-city-marker][aria-pressed="true"]').count();
    return { ok: z1 > z0 * 1.3 || pressed > 0, why: `tap: zoom x${(z1 / z0).toFixed(2)}, selected ${pressed}` };
  });
  await record("globe-long-press", Math.min(ROUNDS, 5), async (i) => {
    if (i) await reset();
    const box = await g.globe.boundingBox();
    const p = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.7 };
    const menus = await g.page.evaluate(() => window.__menusAllowed);
    await g.touch("touchStart", [p]);
    await sleep(900);
    await g.touch("touchEnd", []);
    await sleep(100);
    const after = await g.page.evaluate(() => ({ menus: window.__menusAllowed, selection: String(getSelection() || "") }));
    return { ok: after.menus === menus && !after.selection, why: `context menu shown ${after.menus - menus}, selected "${after.selection.slice(0, 20)}"` };
  });
  if (g) {
    await g.page.screenshot({ path: `${out}/globe-after-gestures.png` });
    if (g.errors.length) console.log("globe page errors:", g.errors.slice(0, 3));
    await g.context.close();
  }
}

// ---------- Vertical page scroll around the globe ----------
await record("page-scroll-below-globe", Math.min(ROUNDS, 5), async () => {
  const s = await phone(people);
  try {
    await s.page.goto(root + "/explore?section=people", { waitUntil: "networkidle" });
    await s.page.locator('svg[aria-label^="Globe of members"]').waitFor();
    const heading = s.page.getByRole("heading", { name: /around the world|charlotte/i }).first();
    await heading.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = await heading.boundingBox();
    const y0 = (await pageState(s.page)).scrollY;
    const x = 40;
    await s.touch("touchStart", [{ x, y: box.y + 10 }]);
    for (let k = 1; k <= 8; k++) { await s.touch("touchMove", [{ x, y: box.y + 10 - k * 25 }]); await sleep(16); }
    await s.touch("touchEnd", []);
    await sleep(500);
    const y1 = (await pageState(s.page)).scrollY;
    return { ok: y1 > y0 + 50, why: `page scrolled ${y1 - y0}px` };
  } finally {
    await s.context.close();
  }
});

// ---------- Pipeline press-and-hold drag ----------
await record("pipeline-hold-drag", ROUNDS, async () => {
  const moves = [];
  const s = await phone({ pipeline_items: async (req) => (req.method() === "PATCH" ? (moves.push(req.postDataJSON()), { body: [] }) : null) });
  try {
    await s.page.goto(root + "/pipeline", { waitUntil: "networkidle" });
    const card = s.page.locator('[data-contact-card="Amanda Hayes"]');
    await card.waitFor();
    const box = await card.boundingBox();
    const start = { x: box.x + box.width * between(0.3, 0.7), y: box.y + box.height * between(0.3, 0.7) };
    await s.touch("touchStart", [start]);
    // Hold with a slightly shaky finger.
    const hold = between(280, 480);
    const t0 = Date.now();
    while (Date.now() - t0 < hold) {
      await sleep(between(40, 90));
      await s.touch("touchMove", [{ x: start.x + jitter(5), y: start.y + jitter(5) }]);
    }
    for (let k = 1; k <= 12; k++) { await s.touch("touchMove", [{ x: start.x + ((380 - start.x) * k) / 12, y: start.y + 4 + jitter(2) }]); await sleep(16); }
    const contacted = s.page.locator('[data-stage-column="Contacted"]');
    for (let k = 0; k < 90 && (await contacted.boundingBox()).x > 120; k++) { await s.touch("touchMove", [{ x: 380, y: start.y + 4 + (k % 2) }]); await sleep(25); }
    // Like a person: move toward the column, keep re-aiming at where it is now, then settle over it.
    let at = { x: 380, y: start.y + 4 };
    const aim = async () => { const t = await contacted.boundingBox(); return { x: Math.min(370, Math.max(20, t.x + t.width / 2)), y: t.y + 120 }; };
    const offset = { x: jitter(10), y: jitter(10) };
    for (let k = 1; k <= 8; k++) {
      const d = await aim();
      at = { x: at.x + ((d.x + offset.x - at.x) * k) / 8, y: at.y + ((d.y + offset.y - at.y) * k) / 8 };
      await s.touch("touchMove", [at]); await sleep(20);
    }
    for (let k = 0; k < 6; k++) { const d = await aim(); at = { x: d.x + offset.x, y: d.y + offset.y }; await s.touch("touchMove", [at]); await sleep(60); }
    await s.touch("touchEnd", []);
    await sleep(450);
    const ok = moves.length === 1 && moves[0].stage_id === fixtures.stages[1].id;
    const sel = (await pageState(s.page)).selection;
    return { ok: ok && !sel, why: `moves ${JSON.stringify(moves.map((m) => m.stage_id?.slice(-1)))}${sel ? `, text selected "${sel.slice(0, 20)}"` : ""}` };
  } finally {
    await s.context.close();
  }
});

// ---------- Photo crop: drag and pinch ----------
{
  const wanted = !only || only.some((o) => o.startsWith("crop"));
  let s = null;
  const openCrop = async () => {
    s = await phone({});
    await s.page.goto(root + "/feed", { waitUntil: "networkidle" });
    await s.page.getByRole("button", { name: /create/i }).last().click();
    await s.page.getByRole("button", { name: /^post$/i }).first().click();
    const chooser = s.page.waitForEvent("filechooser");
    await s.page.getByRole("button", { name: /choose a photo|photo/i }).first().click();
    await (await chooser).setFiles(process.env.PHOTO || "/workspace/audit-nov14/fixtures/product.jpg");
    await s.page.locator("img.max-w-none").waitFor({ timeout: 10000 });
  };
  if (wanted) await openCrop();
  const img = () => s.page.locator("img.max-w-none").boundingBox();
  const frame = () => s.page.locator("img.max-w-none").locator("xpath=..").boundingBox();
  await record("crop-pinch", ROUNDS, async (i) => {
    const f = await frame();
    const a = await img();
    const zoomOut = a.width > f.width * 2.2;
    const mid = { x: f.x + f.width / 2 + jitter(30), y: f.y + f.height / 2 + jitter(30) };
    const fx = (mid.x - a.x) / a.width, fy = (mid.y - a.y) / a.height;
    const d0 = zoomOut ? between(160, 200) : between(60, 90);
    const factor = zoomOut ? between(0.5, 0.7) : between(1.4, 1.8);
    await pinch(s.touch, mid, between(0, Math.PI), d0, d0 * factor, Math.round(between(8, 12)), between(10, 20));
    await sleep(60);
    const b = await img();
    await s.touch("touchEnd", []);
    await sleep(80);
    const scale0 = a.width / f.width, scale1 = b.width / f.width;
    const expected = Math.min(3, Math.max(1, scale0 * factor)) / scale0;
    const drift = Math.hypot(b.x + fx * b.width - mid.x, b.y + fy * b.height - mid.y);
    const clamped = scale0 * factor > 3 || scale0 * factor < 1;
    const ok = Math.abs(b.width / a.width / expected - 1) < 0.12 && (clamped || drift < 12);
    return { ok, why: `photo x${(b.width / a.width).toFixed(2)} expected x${expected.toFixed(2)}, drift ${drift.toFixed(0)}px` };
  });
  await record("crop-drag", ROUNDS, async () => {
    const f = await frame();
    const a = await img();
    const p = { x: f.x + f.width * between(0.3, 0.7), y: f.y + f.height * between(0.3, 0.7) };
    const dx = between(-50, 50), dy = between(-50, 50);
    await s.touch("touchStart", [p]);
    for (let k = 1; k <= 8; k++) { await s.touch("touchMove", [{ x: p.x + (dx * k) / 8, y: p.y + (dy * k) / 8 }]); await sleep(14); }
    await s.touch("touchEnd", []);
    await sleep(60);
    const b = await img();
    const err = Math.hypot(b.x - a.x - dx, b.y - a.y - dy);
    return { ok: err < 4, why: `photo off the finger by ${err.toFixed(1)}px` };
  });
  if (s) {
    await s.page.screenshot({ path: `${out}/crop-after-gestures.png` });
    await s.context.close();
  }
}

// ---------- Swipe deck ----------
await record("swipe-deck", ROUNDS, async (i) => {
  const s = await phone(people);
  try {
    await s.page.goto(root + "/explore?section=people", { waitUntil: "networkidle" });
    const deck = s.page.getByRole("region", { name: "Swipe through profiles" });
    await deck.waitFor();
    await deck.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await sleep(200);
    const active = () => s.page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="slide"]')].findIndex((el) => el.getAttribute("aria-hidden") !== "true"));
    const a0 = await active();
    const box = await deck.boundingBox();
    const y = box.y + box.height * between(0.3, 0.6);
    const x0 = box.x + box.width * between(0.7, 0.85);
    const dist = between(110, 200);
    await s.touch("touchStart", [{ x: x0, y }]);
    for (let k = 1; k <= 8; k++) { await s.touch("touchMove", [{ x: x0 - (dist * k) / 8, y: y + jitter(6) }]); await sleep(between(10, 22)); }
    await s.touch("touchEnd", []);
    await sleep(900);
    const a1 = await active();
    return { ok: a1 === a0 + 1, why: `card ${a0} -> ${a1} after a ${dist.toFixed(0)}px swipe` };
  } finally {
    await s.context.close();
  }
});

// ---------- Pipeline: a second finger lands during the hold ----------
await record("pipeline-second-finger", ROUNDS, async () => {
  const moves = [];
  const s = await phone({ pipeline_items: async (req) => (req.method() === "PATCH" ? (moves.push(req.postDataJSON()), { body: [] }) : null) });
  try {
    await s.page.goto(root + "/pipeline", { waitUntil: "networkidle" });
    const card = s.page.locator('[data-contact-card="Amanda Hayes"]');
    await card.waitFor();
    const box = await card.boundingBox();
    const start = { x: box.x + box.width * between(0.3, 0.7), y: box.y + box.height * between(0.3, 0.7), id: 1 };
    await s.touch("touchStart", [start]);
    await sleep(between(260, 400));
    await s.touch("touchMove", [{ ...start, x: start.x + jitter(3), y: start.y + jitter(3) }]);
    // A thumb brushes the screen and lifts again while the card is held.
    const thumb = { x: between(40, 350), y: between(650, 780), id: 2 };
    await s.touch("touchStart", [start, thumb]);
    await sleep(between(40, 120));
    await s.touch("touchEnd", []);
    await sleep(500);
    const lifted = await s.page.evaluate(() => !!document.querySelector('[data-contact-card="Amanda Hayes"]') && document.body.style.cursor === "");
    const ok = moves.length === 0 && lifted;
    const stuck = await s.page.evaluate(() => document.querySelectorAll("[data-dnd-overlay], .dnd-overlay").length);
    return { ok: ok && !stuck, why: `moves ${moves.length}, overlay left ${stuck}` };
  } finally {
    await s.context.close();
  }
});

// ---------- Globe: lift one finger of a pinch and keep turning ----------
await record("globe-pinch-then-pan", ROUNDS, async () => {
  const g = await openGlobe();
  try {
    const lead = await markerAt(g.page, "Charlotte");
    const angle = between(0, Math.PI);
    const d1 = between(110, 150);
    const mid = { x: lead.x + jitter(5), y: lead.y + jitter(5) };
    await pinch(g.touch, mid, angle, between(60, 90), d1, 8, 16);
    const f1 = { x: mid.x - (Math.cos(angle) * d1) / 2, y: mid.y - (Math.sin(angle) * d1) / 2, id: 1 };
    await sleep(40);
    const pre = await markerAt(g.page, "Charlotte");
    // touchEnd with a point lifts just that finger: finger 2 lifts, finger 1 stays down.
    const f2 = { x: mid.x + (Math.cos(angle) * d1) / 2, y: mid.y + (Math.sin(angle) * d1) / 2, id: 2 };
    await g.touch("touchEnd", [f2]);
    await sleep(40);
    const a = await markerAt(g.page, "Charlotte");
    const dx = between(-40, 40), dy = between(-30, 30);
    for (let k = 1; k <= 8; k++) { await g.touch("touchMove", [{ ...f1, x: f1.x + (dx * k) / 8, y: f1.y + (dy * k) / 8 }]); await sleep(16); }
    await sleep(60);
    const b = await markerAt(g.page, "Charlotte");
    await g.touch("touchEnd", []);
    if (!pre || !a || !b) return { ok: false, why: "marker went behind the globe" };
    // No jump when the second finger lifts, then the globe keeps turning with the finger left.
    // (Charlotte is not the grabbed point, so near the zoomed edge it may move a bit more or less.)
    const jump = Math.hypot(a.x - pre.x, a.y - pre.y);
    const off = Math.hypot(b.x - a.x - dx, b.y - a.y - dy);
    const along = ((b.x - a.x) * dx + (b.y - a.y) * dy) / Math.max(1, dx * dx + dy * dy);
    return { ok: jump < 4 && along > 0.75 && along < 1.4, why: `jump at lift ${jump.toFixed(1)}px, follows x${along.toFixed(2)} (off ${off.toFixed(0)}px)` };
  } finally {
    await g.context.close();
  }
});

// ---------- Board canvas pinch ----------
{
  const boardId = "00000000-0000-4000-8000-00000000b0a1";
  const note = (i, x, y) => ({ id: `00000000-0000-4000-8000-0000000b${String(i).padStart(4, "0")}`, board_id: boardId, type: "note", title: `Note ${i}`, content: { text: `Note ${i}` }, x, y, w: 160, h: 120, rotation: 0, z_index: i, parent_item_id: null, is_trashed: false, created_by: me, created_at: now, updated_at: now });
  const board = {
    boards: () => ({ body: [{ id: boardId, owner_user_id: me, title: "Moodboard", description: null, is_trashed: false, created_at: now, updated_at: now }] }),
    board_items: (req) => (req.method() === "GET" ? { body: [note(1, 40, 60), note(2, 220, 300)] } : { body: [] }),
    board_members: () => ({ body: [{ board_id: boardId, user_id: me, role: "owner" }] }),
    board_connectors: () => ({ body: [] }),
  };
  await record("board-pinch", ROUNDS, async () => {
    const s = await phone(board);
    try {
      await s.page.goto(root + `/boards/${boardId}`, { waitUntil: "networkidle" });
      const inner = s.page.locator(".canvas-inner");
      await inner.waitFor({ timeout: 10000 });
      const view = () => inner.evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); const c = el.parentElement.getBoundingClientRect(); return { s: m.a, x: m.e, y: m.f, left: c.left, top: c.top }; });
      const canvas = await inner.locator("xpath=..").boundingBox();
      const v0 = await view();
      // Pinch on empty canvas between the two notes.
      const mid = { x: canvas.x + canvas.width * between(0.55, 0.8), y: canvas.y + canvas.height * between(0.15, 0.3) };
      const factor = between(1.3, 1.8);
      const d0 = between(70, 100);
      await pinch(s.touch, mid, between(0, Math.PI), d0, d0 * factor, 10, 16);
      await sleep(80);
      const v1 = await view();
      await s.touch("touchEnd", []);
      // The content point that was under the fingers is still under them.
      const px = (mid.x - v0.left - v0.x) / v0.s, py = (mid.y - v0.top - v0.y) / v0.s;
      const drift = Math.hypot(v1.left + v1.x + px * v1.s - mid.x, v1.top + v1.y + py * v1.s - mid.y);
      const ratio = v1.s / v0.s;
      const ok = Math.abs(ratio / factor - 1) < 0.12 && drift < 14;
      return { ok, why: `board x${ratio.toFixed(2)} for fingers x${factor.toFixed(2)}, drift ${drift.toFixed(0)}px` };
    } finally {
      await s.context.close();
    }
  });
}

// ---------- Keyboard (existing check) ----------
if (!only || only.includes("keyboard")) {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const run = spawnSync(process.execPath, [here + "keyboard-check.mjs"], { env: { ...process.env, ROOT: root, OUT: out + "/keyboard" }, encoding: "utf8" });
  const ok = run.status === 0;
  results.keyboard = { ok: ok ? 1 : 0, rounds: 1 };
  console.log(`${ok ? "PASS" : "FAIL"} keyboard ${ok ? "1/1" : "0/1 :: " + (run.stderr || run.stdout).split("\n").filter(Boolean).slice(-3).join(" | ")}`);
}

await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 1));
const summary = Object.entries(results).map(([k, v]) => `${k} ${v.ok}/${v.rounds}`);
console.log("\n" + summary.join("\n"));
if (process.env.STRICT && Object.values(results).some((v) => v.ok !== v.rounds)) process.exit(1);
