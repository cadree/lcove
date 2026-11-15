// Explore Nearby / Global check at phone size (390x844, touch, mobile), with fixture members.
// Screenshots: one people list; Global city cards; a tapped city's sheet; Nearby street map in
// Charlotte (city level, then with live areas); real touch pinch and drag on the street map.
//   ROOT=http://127.0.0.1:8095 OUT=/tmp/explore node scripts/explore-nearby-check.mjs
// The street map loads real OpenFreeMap tiles, so this needs network access.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8095";
const out = process.env.OUT || "/tmp/explore";
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const me = fixtures.me;
const now = new Date().toISOString();
const until = new Date(Date.now() + 86_400_000).toISOString();
const faces = (process.env.FACES || "").split(",").filter(Boolean);

const label = { "charlotte|nc": "Charlotte, NC", "concord|nc": "Concord, NC", "raleigh|nc": "Raleigh, NC", "atlanta|ga": "Atlanta, GA", "miami|fl": "Miami, FL", "tokyo|jp": "Tokyo, Japan" };
const roster = [
  ["Rezza Monet", "charlotte|nc", "Photographer"], ["Jade Okafor", "charlotte|nc", "Stylist"], ["Theo Park", "charlotte|nc", "Producer"],
  ["Nia Brooks", "charlotte|nc", "Dancer"], ["Sol Rivera", "concord|nc", "DJ"], ["Ari Chen", "raleigh|nc", "Director"],
  ["Kai Moore", "atlanta|ga", "Rapper"], ["Lena Cruz", "atlanta|ga", "Designer"], ["Mila Santos", "miami|fl", "Model"],
  ["Dre Wallace", "miami|fl", "Videographer"], ["Ivy Laurent", "miami|fl", "Painter"], ["Ren Sato", "tokyo|jp", "Illustrator"],
];
const hue = (i) => (i * 47) % 360;
const members = roster.map(([name, key, skill], i) => ({
  user_id: `00000000-0000-4000-8000-0000000e${String(i).padStart(4, "0")}`,
  display_name: name, avatar_url: `https://faces.fixture.test/${i}.${faces[i] ? "jpg" : "svg"}`,
  city: label[key], city_display: label[key], city_key: key, bio: `${skill} in ${label[key].split(",")[0]}.`, created_at: now,
}));
// Two Charlotte members share a live ~1 km area (NoDa and South End); the rest are city only.
const areas = { 1: [-80.81, 35.25], 3: [-80.86, 35.21] };
const signals = members.map((m, i) => ({
  user_id: m.user_id, liked: null, trip: i === 2 ? { city_key: "miami|fl", city_label: "Miami, FL", starts_on: "2026-12-04", ends_on: "2026-12-08" } : null,
  live_city_key: areas[i] ? "charlotte|nc" : null, live_until: areas[i] ? until : null, live_area: areas[i] || null,
}));
const profile = { id: me, user_id: me, display_name: "Maya Cole", avatar_url: null, city: "Charlotte", city_display: "Charlotte, NC", city_key: "charlotte|nc", bio: "", onboarding_completed: true, access_status: "active", created_at: now };
const mine = { ...profile, user_id: me, avatar_url: null };
let settings = { discoverable: true, matches_only: false, live_city_key: null, live_until: null, live_area: null };
const calls = [];
const mock = {
  profiles: (req, url) => (url.pathname.endsWith("/profiles_public") && url.searchParams.get("select")?.includes("city_key") ? { body: [mine, ...members] } : { body: [profile] }),
  discovery_globe: () => ({ body: [{ user_id: me, liked: null, trip: null, live_city_key: settings.live_city_key, live_until: settings.live_until, live_area: settings.live_area }, ...signals] }),
  discovery_settings: () => ({ body: settings }),
  discovery_live_area: (req) => {
    const args = JSON.parse(req.postData() || "{}");
    calls.push({ fn: "discovery_live_area", args });
    settings = { ...settings, live_city_key: args.p_city_key, live_until: until, live_area: [Math.round(args.p_lon * 100) / 100, Math.round(args.p_lat * 100) / 100] };
    return { body: settings };
  },
  discovery_live_city: (req) => {
    const args = JSON.parse(req.postData() || "{}");
    calls.push({ fn: "discovery_live_city", args });
    settings = { ...settings, live_city_key: args.p_city_key, live_until: args.p_city_key ? until : null, live_area: null };
    return { body: settings };
  },
  creative_trip_list: (req) => {
    const city = JSON.parse(req.postData() || "{}").p_city;
    return { body: city === "miami|fl" ? [{ id: "t1", organizer_id: members[2].user_id, city_key: "miami|fl", city_label: "Miami, FL", title: "Art Basel week", starts_on: "2026-12-04", ends_on: "2026-12-08", capacity: 6, notes: "Gallery hopping, a shoot on the beach, and the Wynwood walls.", status: "planning", conversation_id: "c1", joined: false, member_count: 2, roster: [{ user_id: members[2].user_id, display_name: "Theo Park" }, { user_id: members[0].user_id, display_name: "Rezza Monet" }] }] : [] };
  },
  creative_match_list: () => ({ body: [] }),
};

const browser = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, geolocation: { latitude: 35.2468712, longitude: -80.8123097, accuracy: 30 }, permissions: ["geolocation"] });
await signedIn(context);
// Instant scrolling, so screenshots land where the script scrolled.
await context.addInitScript(() => addEventListener("DOMContentLoaded", () => { document.documentElement.style.scrollBehavior = "auto"; }));
await context.route("https://faces.fixture.test/**", (route) => {
  const i = Number(route.request().url().split("/").pop().split(".")[0]);
  if (faces[i]) return route.fulfill({ status: 200, contentType: "image/jpeg", body: readFileSync(faces[i]) });
  const [first, last] = roster[i][0].split(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue(i)} 45% 55%)"/><stop offset="1" stop-color="hsl(${hue(i) + 40} 50% 25%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="74" font-family="Helvetica" font-size="40" font-weight="700" fill="#faf4ed" text-anchor="middle">${first[0]}${last[0]}</text></svg>`;
  return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/WebSocket|favicon/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await mockSupabase(page, mock);
const cdp = await context.newCDPSession(page);
const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
const report = { checks: {}, errors, calls };
const ok = (name, pass, detail) => { report.checks[name] = { pass, detail }; console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` :: ${detail}` : ""}`); };

// 1. Explore: one people list.
await page.goto(root + "/explore", { waitUntil: "networkidle" });
await page.locator('svg[aria-label^="Globe of members"]').waitFor({ timeout: 20000 });
await sleep(600);
const text = await page.locator("main").innerText();
ok("one-people-list", !/Directory/i.test(text) && !/Everyone ·/.test(text) && (await page.getByRole("button", { name: /^See all/ }).count()) >= 1, `directory heading ${/Directory/i.test(text)}, everyone list ${/Everyone ·/.test(text)}`);
await page.screenshot({ path: `${out}/01-explore-top.png` });
await page.getByRole("heading", { name: "Around the world" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => window.scrollBy(0, -260));
await sleep(500);
await page.screenshot({ path: `${out}/01b-explore-one-people-list.png` });
await page.screenshot({ path: `${out}/01c-explore-full-page.png`, fullPage: true });
await page.getByRole("button", { name: /^See all \d+/ }).click();
await sleep(500);
await page.screenshot({ path: `${out}/02-see-all-sheet.png` });
ok("see-all-opens-list", (await page.getByRole("dialog").getByRole("link").count()) >= members.length, `${await page.getByRole("dialog").getByRole("link").count()} members listed`);
await page.keyboard.press("Escape");
await sleep(400);

// 2. Global: city cards on the globe.
const globe = page.locator('svg[aria-label^="Globe of members"]');
await globe.evaluate((el) => el.scrollIntoView({ block: "center" }));
await sleep(400);
const cards = await page.locator("[data-city-marker]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const faceImages = await globe.locator("image").count();
ok("global-city-cards", cards.length >= 1 && faceImages === 0, `${cards.length} cards (${cards.join(" | ")}), ${faceImages} face images on the globe`);
await globe.screenshot({ path: `${out}/03-global-city-cards.png` });
// Turn the globe to Miami with the picker, then tap its card. At world zoom it is folded in with the
// other east-coast cities, so the first tap zooms in (centred on Miami) and the next one opens it.
await page.selectOption('select[aria-label="Select a city or state"]', "miami|fl");
await sleep(900);
for (let tap = 0; tap < 3 && !(await page.getByRole("dialog").count()); tap++) {
  await page.locator('[data-city-marker][aria-label^="Miami"]').first().tap();
  await sleep(1000);
}
const sheet = page.getByRole("dialog");
ok("city-sheet", (await sheet.getByText("Members in Miami, FL").count()) === 1, `sheet title found ${(await sheet.getByText("Members in Miami, FL").count())}, zoom ${await globe.getAttribute("data-zoom")}`);
await page.screenshot({ path: `${out}/04-city-sheet-miami.png` });
await sheet.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
await sleep(400);
ok("city-sheet-travel-row", (await sheet.getByText(/Members traveling to Miami/).count()) === 1);
await page.screenshot({ path: `${out}/05-city-sheet-miami-travel.png` });
await page.keyboard.press("Escape");
await sleep(500);

// 3. Nearby: Charlotte street map, city level and areas, card deck below.
await page.getByRole("button", { name: "Nearby", exact: true }).click();
const map = page.locator("[data-street-map]");
await map.waitFor({ timeout: 20000 });
await page.waitForFunction(() => document.querySelector("[data-street-map]")?.getAttribute("data-ready") === "1", null, { timeout: 30000 });
await page.waitForLoadState("networkidle").catch(() => undefined);
await sleep(2500);
await map.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => window.scrollBy(0, -70));
await sleep(800);
const pins = await page.locator("[data-map-pin]").evaluateAll((els) => els.map((e) => `${e.dataset.mapPin}: ${e.getAttribute("aria-label")}`));
const center = (await map.getAttribute("data-center")).split(",").map(Number);
ok("nearby-charlotte", Math.abs(center[0] + 80.84) < 0.06 && Math.abs(center[1] - 35.23) < 0.06 && Number(await map.getAttribute("data-zoom")) >= 11 && pins.length >= 2, `center ${center}, pins: ${pins.join(" | ")}`);
ok("nearby-no-far-cities", !pins.some((p) => /Raleigh|Atlanta|Miami|Tokyo/.test(p)));
await page.screenshot({ path: `${out}/06-nearby-charlotte-map-and-deck.png` });
await page.locator("h3", { hasText: "Members near" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
await sleep(500);
await page.screenshot({ path: `${out}/07-nearby-members-deck.png` });

// 4. Street map gestures: real touch pinch and drag; the page must not zoom or scroll.
await map.evaluate((el) => el.scrollIntoView({ block: "center" }));
await sleep(1500);
const state = () => page.evaluate(() => ({ scale: visualViewport?.scale ?? 1, y: Math.round(scrollY), zoom: Number(document.querySelector("[data-street-map]").dataset.zoom), center: document.querySelector("[data-street-map]").dataset.center.split(",").map(Number) }));
const box = await map.boundingBox();
const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
const pinch = async (d0, d1) => {
  const at = (d) => [{ x: mid.x - d / 2, y: mid.y }, { x: mid.x + d / 2, y: mid.y }];
  await touch("touchStart", at(d0));
  for (let i = 1; i <= 12; i++) { await touch("touchMove", at(d0 + ((d1 - d0) * i) / 12)); await sleep(16); }
  await touch("touchEnd", []);
  await sleep(700);
};
for (let round = 0; round < 5; round++) {
  const a = await state();
  await pinch(60, 140);
  const b = await state();
  await pinch(140, 60);
  const c = await state();
  const inOk = b.zoom > a.zoom + 0.6 || b.zoom >= 14.4;
  const outOk = c.zoom < b.zoom - 0.6;
  ok(`street-pinch-${round + 1}`, inOk && outOk && b.scale === 1 && c.scale === 1 && a.y === c.y, `zoom ${a.zoom} -> ${b.zoom} -> ${c.zoom}, page scale ${b.scale}/${c.scale}, scroll ${a.y}->${c.y}`);
}
for (let round = 0; round < 5; round++) {
  const a = await state();
  const start = { x: mid.x - 60, y: mid.y - 40 };
  await touch("touchStart", [start]);
  for (let i = 1; i <= 12; i++) { await touch("touchMove", [{ x: start.x + i * 10, y: start.y + i * 7 }]); await sleep(16); }
  await touch("touchEnd", []);
  await sleep(700);
  const b = await state();
  const moved = Math.hypot(b.center[0] - a.center[0], b.center[1] - a.center[1]);
  ok(`street-drag-${round + 1}`, moved > 0.001 && b.y === a.y && b.scale === 1, `center moved ${moved.toFixed(4)}°, page scroll ${a.y}->${b.y}`);
}
const maxZoom = await (async () => { for (let i = 0; i < 4; i++) await pinch(40, 220); return (await state()).zoom; })();
ok("street-max-zoom-neighborhood", maxZoom <= 14.5, `max zoom ${maxZoom}`);
await page.screenshot({ path: `${out}/08-street-map-after-gestures.png` });

// 5. Opt in to live location: the device point leaves the page only snapped to the grid.
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Nearby", exact: true }).click();
await page.waitForFunction(() => document.querySelector("[data-street-map]")?.getAttribute("data-ready") === "1", null, { timeout: 30000 });
await page.getByRole("switch", { name: "Use my live location" }).click();
await sleep(1500);
const sent = calls.find((c) => c.fn === "discovery_live_area")?.args;
const decimals = (n) => (String(n).split(".")[1] || "").length;
ok("live-area-coarsened", !!sent && decimals(sent.p_lat) <= 2 && decimals(sent.p_lon) <= 2 && sent.p_city_key === "charlotte|nc", JSON.stringify(sent));
ok("live-area-switch-on", (await page.getByRole("switch", { name: "Use my live location" }).getAttribute("aria-checked")) === "true");
await page.waitForLoadState("networkidle").catch(() => undefined);
await sleep(2500);
await map.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => window.scrollBy(0, -70));
await sleep(600);
await page.screenshot({ path: `${out}/09-nearby-live-area-on.png` });
await page.getByRole("switch", { name: "Use my live location" }).click();
await sleep(1200);
ok("live-area-off", calls.at(-1)?.fn === "discovery_live_city" && calls.at(-1)?.args.p_city_key === null);

ok("no-page-errors", errors.length === 0, errors.slice(0, 4).join(" | "));
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
