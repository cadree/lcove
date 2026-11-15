// Globe drag smoothness: frame times, long tasks and how far the grabbed point trails the finger,
// at 390x844 with real touch (CDP) and the CPU throttled like a phone.
//   ROOT=http://127.0.0.1:8081 CPU=4 RUNS=5 node scripts/globe-drag-perf.mjs
// Options: ONLY=drag-ocean,drag-card,fling OUT=report.json TRACE=1 (main-thread breakdown) PROFILE=1 (hot functions) DEBUG=1
// cspell:words longtask networkidle
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const CPU = Number(process.env.CPU || 4);
const RUNS = Number(process.env.RUNS || 5);
const OUT = process.env.OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const me = fixtures.me;
const now = new Date().toISOString();
const cityOf = ["charlotte|nc", "charlotte|nc", "charlotte|nc", "charlotte|nc", "raleigh|nc", "raleigh|nc", "durham|nc", "atlanta|ga", "atlanta|ga", "atlanta|ga", "los angeles|ca"];
const label = { "charlotte|nc": "Charlotte, NC", "raleigh|nc": "Raleigh, NC", "durham|nc": "Durham, NC", "atlanta|ga": "Atlanta, GA", "los angeles|ca": "Los Angeles, CA" };
const members = cityOf.map((key, i) => ({ user_id: `00000000-0000-4000-8000-0000000c${String(i).padStart(4, "0")}`, display_name: `Member ${i + 1}`, avatar_url: null, city: label[key], city_display: label[key], city_key: key, bio: "Director", created_at: now }));
const profile = { id: me, user_id: me, display_name: "Maya Cole", avatar_url: null, city: "Charlotte", city_display: "Charlotte, NC", city_key: "charlotte|nc", bio: "", onboarding_completed: true, access_status: "active", created_at: now };
const people = {
  profiles: (req, url) => (url.pathname.endsWith("/profiles_public") && url.searchParams.get("select")?.includes("city_key") ? { body: members } : { body: [profile] }),
  discovery_globe: () => ({ body: members.map((m) => ({ user_id: m.user_id, live_city_key: null, live_until: null, trip: null, liked: null })) }),
  discovery_settings: () => ({ body: { discoverable: true, live_city_key: null } }),
};

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await signedIn(context);
await context.addInitScript(() => {
  // Where Charlotte's marker sits on screen: its translate() through the svg's screen matrix, so it
  // works for any marker drawing (faces before #92, cards after) and any way it is moved.
  window.__cityAt = (svg) => {
    const m = [...svg.querySelectorAll("[data-city-marker]")].find((el) => el.getAttribute("aria-label").startsWith("Charlotte"));
    if (!m) return null;
    const local = m.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix();
    const ctm = m.parentNode.getScreenCTM().multiply(local);
    return { x: ctm.e, y: ctm.f };
  };
  window.__long = [];
  try {
    new PerformanceObserver((list) => window.__long.push(...list.getEntries().map((e) => ({ t: e.startTime, d: e.duration })))).observe({ type: "longtask", buffered: true });
  } catch { /* not supported */ }
});
const page = await context.newPage();
await mockSupabase(page, people);
const cdp = await context.newCDPSession(page);
const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });

async function load() {
  // Load at full speed (startup is not what is measured), then throttle like a phone for the drag.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.goto(root + "/explore?section=people", { waitUntil: "networkidle" });
  const globe = page.locator('svg[aria-label^="Globe of members"]');
  await globe.waitFor({ timeout: 30000 }).catch(async (e) => { await page.screenshot({ path: "/tmp/perf-fail.png" }); console.log(page.url()); throw e; });
  await globe.evaluate((el) => el.scrollIntoView({ block: "center" }));
  // Let the detail layers (#91) arrive, as they would on a phone after a couple of seconds.
  await sleep(3500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await sleep(300);
  return globe.boundingBox();
}

/** Every animation frame: its time, the Charlotte anchor on screen, and how many svg nodes changed. */
async function startProbe() {
  await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label^="Globe of members"]');
    window.__probe = { frames: [], mut: 0, t0: performance.now(), run: true };
    window.__obs = new MutationObserver((list) => { window.__probe.mut += list.length; });
    window.__obs.observe(svg, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = (t) => {
      const p = window.__probe;
      if (!p.run) return;
      const r = window.__cityAt(svg);
      const cards = svg.querySelectorAll("[data-city-marker]").length;
      // Paths that are globe layers (land, borders, lakes...), not parts of the city markers.
      const layers = [...svg.querySelectorAll("path")].filter((el) => !el.closest("[data-city-marker]")).length;
      p.frames.push({ t, x: r ? r.x : null, y: r ? r.y : null, layers, cards, rot: svg.getAttribute("data-rotation") });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
async function stopProbe() {
  return page.evaluate(() => {
    const p = window.__probe;
    p.run = false;
    window.__obs.disconnect();
    const long = window.__long.filter((e) => e.t >= p.t0);
    return { frames: p.frames, mut: p.mut, long };
  });
}

function stats(frames, long, fingers) {
  const dts = frames.slice(1).map((f, i) => f.t - frames[i].t);
  const sorted = [...dts].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  // Lag: distance from the grabbed city to where the finger was at that frame's time.
  const lags = [];
  for (const f of frames) {
    if (f.x == null) continue;
    const finger = [...fingers].reverse().find((g) => g.t <= f.t);
    if (finger) lags.push(Math.hypot(f.x - finger.x - finger.ox, f.y - finger.y - finger.oy));
  }
  lags.sort((a, b) => a - b);
  const pathsSeen = new Set(frames.map((f) => f.layers));
  // How often the globe itself moved (its rotation changed), and the longest it stood still while the finger moved.
  const firstMove = fingers[0]?.t ?? 0;
  const lastMove = fingers.at(-1)?.t ?? 0;
  const changes = frames.filter((f, i) => i && f.rot !== frames[i - 1].rot && f.t >= firstMove && f.t <= lastMove + 50).map((f) => f.t);
  const stills = changes.slice(1).map((t, i) => t - changes[i]);
  if (process.env.DEBUG) console.log("moves at", changes.map((t) => Math.round(t - firstMove)).join(","), "fingers", Math.round(lastMove - firstMove), "ms");
  const layerFlips = frames.filter((f, i) => i && f.layers !== frames[i - 1].layers).length;
  return {
    frames: frames.length,
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    max: +(sorted.at(-1) ?? 0).toFixed(1),
    over33: dts.filter((d) => d > 33.4).length,
    longTasks: long.length,
    longTaskMs: Math.round(long.reduce((a, e) => a + e.d, 0)),
    lagP50: +(lags[Math.floor(lags.length / 2)] ?? 0).toFixed(1),
    lagP95: +(lags[Math.floor(lags.length * 0.95)] ?? 0).toFixed(1),
    globeFps: Math.round((changes.length * 1000) / Math.max(1, lastMove - firstMove)),
    maxStillMs: Math.round(Math.max(0, ...stills)),
    layerSets: [...pathsSeen].join("/"),
    layerFlips,
    // How far the globe kept turning after the finger lifted (coasting), in degrees of longitude.
    coastDeg: (() => {
      const lon = (f) => Number(f?.rot?.split(",")[0]);
      const atLift = [...frames].reverse().find((f) => f.t <= lastMove + 20);
      const d = lon(frames.at(-1)) - lon(atLift);
      return Number.isFinite(d) ? +Math.abs(((d + 540) % 360) - 180).toFixed(1) : null;
    })(),
  };
}

async function anchor() {
  return page.evaluate(() => window.__cityAt(document.querySelector('svg[aria-label^="Globe of members"]')));
}

/** One finger: from `start`, `steps` moves of (dx,dy) spread over `ms`, then lift. */
async function drag(start, dx, dy, steps, ms, onCity) {
  const lead = await anchor();
  await startProbe();
  const t0 = await page.evaluate(() => performance.now());
  const wall0 = Date.now();
  const fingers = [];
  await touch("touchStart", [start]);
  for (let s = 1; s <= steps; s++) {
    const p = { x: start.x + (dx * s) / steps, y: start.y + (dy * s) / steps };
    await touch("touchMove", [p]);
    fingers.push({ t: t0 + (Date.now() - wall0), x: p.x, y: p.y, ox: onCity ? 0 : lead.x - start.x, oy: onCity ? 0 : lead.y - start.y });
    const wait = (ms * s) / steps - (Date.now() - wall0);
    if (wait > 0) await sleep(wait);
  }
  await touch("touchEnd", []);
  await sleep(400); // the settle after lifting is part of what the eye sees
  const { frames, mut, long } = await stopProbe();
  return { ...stats(frames, long, fingers), mutations: mut };
}

const TRACE = !!process.env.TRACE;
/** Main-thread time by kind, from a Chrome trace: script, style, layout, paint and the rest. */
function breakdown(trace) {
  const events = trace.traceEvents.filter((e) => e.ph === "X" && e.dur);
  const main = events.find((e) => e.name === "RunTask" && events.some((x) => x.tid === e.tid && x.name === "FunctionCall"))?.tid;
  const kind = { FunctionCall: "script", EvaluateScript: "script", TimerFire: "script", FireAnimationFrame: "script", EventDispatch: "script", "v8.callFunction": "script", UpdateLayoutTree: "style", Layout: "layout", PrePaint: "paint", Paint: "paint", Layerize: "paint", "LocalFrameView::RunPostLifecycleSteps": "other", HitTest: "hit-test", ParseHTML: "other", MajorGC: "gc", MinorGC: "gc" };
  const sums = {};
  // Count only outermost events of each kind on the main thread, so nested ones are not doubled.
  const top = events.filter((e) => e.tid === main && kind[e.name]).sort((a, b) => a.ts - b.ts);
  let end = 0;
  for (const e of top) {
    if (e.ts < end && kind[e.name] === "script") continue;
    if (kind[e.name] === "script") end = e.ts + e.dur;
    sums[kind[e.name]] = (sums[kind[e.name]] || 0) + e.dur / 1000;
  }
  const tasks = events.filter((e) => e.tid === main && e.name === "RunTask");
  sums.busy = tasks.reduce((a, e) => a + e.dur / 1000, 0);
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Math.round(v)]));
}

/** Self time by function from a CPU profile, top 15. */
function hotFunctions(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const f = byId.get(id).callFrame;
    const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop().split("?")[0]}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
  });
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${Math.round(v)}ms ${k}`);
}

const scenarios = {
  // Slow, deliberate drag from the ocean beside the cards (1.5 s, ~90 moves).
  "drag-ocean": (b) => [{ x: b.x + b.width * 0.78, y: b.y + b.height * 0.62 }, -150, -40, 90, 1500, false],
  // Same drag but the finger lands on the Charlotte card (most common: cards cover the visible US).
  "drag-card": async () => { const a = await anchor(); return [{ x: a.x, y: a.y - 20 }, -140, 30, 90, 1500, false]; },
  // Fling: a fast 180 ms swipe, 12 moves.
  fling: (b) => [{ x: b.x + b.width * 0.7, y: b.y + b.height * 0.5 }, -200, 10, 12, 180, false],
};

const results = {};
const only = process.env.ONLY?.split(",");
for (const [name, make] of Object.entries(scenarios)) {
  if (only && !only.includes(name)) continue;
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const box = await load();
    const args = await make(box);
    const tracing = TRACE && i === 0;
    if (tracing) await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink", "v8"] });
    const profiling = process.env.PROFILE && i === 0;
    if (profiling) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
    const run = await drag(...args);
    if (profiling) run.hot = hotFunctions((await cdp.send("Profiler.stop")).profile);
    if (tracing) run.trace = breakdown(JSON.parse((await browser.stopTracing()).toString()));
    runs.push(run);
  }
  const med = (k) => { const v = runs.map((r) => r[k]).filter((x) => typeof x === "number").sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const sum = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, typeof runs[0][k] === "number" ? med(k) : runs[0][k]]));
  results[name] = { median: sum, runs };
  console.log(name.padEnd(11), JSON.stringify(sum), runs[0].trace ? "trace " + JSON.stringify(runs[0].trace) : "", runs[0].hot ? "\n  " + runs[0].hot.join("\n  ") : "");
}
if (OUT) writeFileSync(OUT, JSON.stringify({ root, CPU, RUNS, results }, null, 2));
await browser.close();
