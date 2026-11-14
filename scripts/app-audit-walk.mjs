// Walks the signed-in app with fixture data. Reports console errors, page
// errors, sideways overflow and heap per route, and saves screenshots.
// Usage: OUT=dir WIDTHS=390,1280 node scripts/app-audit-walk.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const out = process.env.OUT || "/tmp/audit-walk";
const routes = (process.env.ROUTES || "/feed,/explore,/explore?section=reels,/messages,/projects,/pipeline,/store,/mall,/calendar,/tickets,/live,/cinema,/travel,/settings,/profile,/notifications,/wallet,/membership,/portfolios,/boards,/today,/collectives,/fund,/quests,/admin,/dashboard,/partners,/community").split(",");
const me = "00000000-0000-4000-8000-0000000000aa";
const stages = ["New", "Contacted", "In Progress", "Closed"].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000050${i}`, owner_user_id: me, pipeline_id: "00000000-0000-4000-8000-000000000600",
  name, sort_order: i, color: ["#3b82f6", "#f59e0b", "#22c55e", "#8b5cf6"][i], created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
}));
const items = ["Amanda Hayes", "Leo Park", "Priya Shah"].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000070${i}`, owner_user_id: me, stage_id: stages[i === 2 ? 1 : 0].id, name, sort_order: i,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", email: null, phone: null, company: ["Hayes Co", "Park Studio", null][i],
  role: ["CEO", "Producer", "Stylist"][i], instagram_url: null, twitter_url: null, linkedin_url: null, tiktok_url: null, website_url: null,
  notes: null, priority: null, status: null, avatar_url: null, last_contacted_at: null, next_follow_up_at: null,
}));
export const fixtures = { stages, items, me };

export async function mockSupabase(page, extra = {}) {
  await page.route("**/*supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS", "content-type": "application/json" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    if (url.pathname.includes("/auth/")) return route.fulfill({ status: 401, headers, body: "{}" });
    const table = url.pathname.split("/rest/v1/")[1];
    const fn = url.pathname.split("/rpc/")[1];
    for (const [key, handler] of Object.entries(extra)) {
      if (table === key || fn === key || url.pathname.includes(key)) {
        const result = await handler(req, url);
        if (result) return route.fulfill({ headers, status: 200, ...result, body: typeof result.body === "string" ? result.body : JSON.stringify(result.body) });
      }
    }
    let body = [];
    if (table === "pipelines") body = [{ id: stages[0].pipeline_id, owner_user_id: me, name: "My Pipeline", is_default: true, sort_order: 0, created_at: "2026-10-01T00:00:00Z" }];
    if (table === "pipeline_stages") body = stages;
    if (table === "pipeline_items") body = req.method() === "GET" ? items : [];
    if (fn === "ensure_default_pipeline") body = stages[0].pipeline_id;
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    await route.fulfill({ status: 200, headers, body: JSON.stringify(single ? (Array.isArray(body) ? body[0] ?? null : body) : body) });
  });
}

const fixtureUser = { id: me, aud: "authenticated", role: "authenticated", email: "maya@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };

export async function signedIn(context) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: me, role: "authenticated", aud: "authenticated", exp: 4102444800 })}.fixture`;
  const session = { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "fixture", user: fixtureUser };
  await context.addInitScript((value) => {
    localStorage.setItem("ether-shot-user", "1");
    localStorage.setItem("welcome_shown_00000000-0000-4000-8000-0000000000aa", "true");
    localStorage.setItem("sb-fixture-auth-token", value);
  }, JSON.stringify(session));
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const report = {};
  for (const width of (process.env.WIDTHS || "390,1280").split(",").map(Number)) {
    const context = await browser.newContext({ colorScheme: "dark", viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: width < 600, isMobile: width < 600 });
    await signedIn(context);
    const page = await context.newPage();
    await mockSupabase(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    for (const route of routes) {
      const errors = [];
      const onConsole = (m) => { if (m.type() === "error" && !/WebSocket connection/.test(m.text())) errors.push(m.text().slice(0, 240)); };
      const onPageError = (e) => errors.push("pageerror: " + e.message.slice(0, 240));
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      try {
        await page.goto(root + route, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        errors.push("goto: " + e.message.slice(0, 120));
      }
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const { metrics } = await cdp.send("Performance.getMetrics");
      const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
      const name = route.replace(/[/?=&]/g, "_").replace(/^_/, "") || "root";
      await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: false, animations: "disabled" }).catch(() => undefined);
      report[`${width} ${route}`] = { finalUrl: page.url().replace(root, ""), overflow, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, errors: [...new Set(errors)] };
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    }
    await context.close();
  }
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  for (const [key, value] of Object.entries(report)) {
    const flags = [value.overflow > 0 ? `OVERFLOW ${value.overflow}px` : "", value.errors.length ? `${value.errors.length} errors` : ""].filter(Boolean).join(" ");
    console.log(`${key.padEnd(34)} heap ${String(value.heapMB).padStart(5)}MB nodes ${String(value.nodes).padStart(6)} ${flags}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
