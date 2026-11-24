// Opens a story on the phone feed with fixture data and checks that the
// reply box, like and close sit on top of everything (nothing covers them),
// that a reply and a like go out, that the reply box stays visible with the
// keyboard open, and that tap-to-advance and close still work.
// Usage: ROOT=http://127.0.0.1:8093 OUT=dir TAG=after node scripts/story-viewer-check.mjs
import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mockSupabase, signedIn } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const out = process.env.OUT || "/tmp/story-viewer-check";
const tag = process.env.TAG || "check";
const KEYBOARD = 336;
mkdirSync(out, { recursive: true });

// iOS Safari: the visual viewport shrinks for the keyboard; the layout viewport does not.
const fakeViewport = () => {
  const target = new EventTarget();
  let keyboard = 0;
  const viewport = {
    get width() { return innerWidth; },
    get height() { return innerHeight - keyboard; },
    get offsetTop() { return 0; },
    get offsetLeft() { return 0; },
    get pageTop() { return scrollY; },
    get pageLeft() { return scrollX; },
    get scale() { return 1; },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  Object.defineProperty(window, "visualViewport", { configurable: true, get: () => viewport });
  window.__keyboard = (height) => {
    keyboard = height;
    target.dispatchEvent(new Event("resize"));
  };
};

// 390x844 and 375x667 are full screens; 390x664 is a 390x844 iPhone with
// Safari's address and tool bars showing.
// Safe areas: iPhone 13 with the bars hidden (or the iOS app) has 47 top and
// 34 bottom; Safari's bottom bar takes over the bottom inset; the SE has 20/0.
// Safari's 100vh is the tall viewport (bars hidden), so with the bars showing
// a vh-sized box is taller than the screen: lvh fakes that for the old code.
const sizes = [
  { name: "390x844", width: 390, height: 844, top: 47, bottom: 34 },
  { name: "375x667", width: 375, height: 667, top: 20, bottom: 0 },
  { name: "390x664-safari-bars", width: 390, height: 664, top: 47, bottom: 0, lvh: 750 },
];

const browser = await chromium.launch({ channel: "chrome" });
const results = [];
const writes = [];
try {
  for (const size of sizes) {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      colorScheme: "dark",
      viewport: { width: size.width, height: size.height },
      screen: { width: size.width, height: size.height },
    });
    await signedIn(context);
    await context.addInitScript(fakeViewport);
    if (size.lvh) {
      await context.addInitScript((lvh) => {
        addEventListener("DOMContentLoaded", () => {
          const style = document.createElement("style");
          style.textContent = `.h-\\[85vh\\] { height: ${0.85 * lvh}px !important; }`;
          document.head.appendChild(style);
        });
      }, size.lvh);
    }
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: size.top, bottom: size.bottom, left: 0, right: 0 } });
    await mockSupabase(page, {
      get_or_create_direct_conversation: () => ({ body: JSON.stringify("00000000-0000-4000-8000-00000000c0c0") }),
      messages: (req) => {
        if (req.method() !== "POST") return null;
        writes.push({ size: size.name, table: "messages", body: req.postDataJSON() });
        return { status: 201, body: { id: "00000000-0000-4000-8000-00000000eeee" } };
      },
      story_reactions: (req) => {
        if (req.method() === "GET") return null;
        writes.push({ size: size.name, table: "story_reactions", method: req.method(), body: req.postData() ? req.postDataJSON() : null });
        return { status: 201, body: [] };
      },
      "notify-chat-message": () => ({ body: {} }),
      "send-push-notification": () => ({ body: {} }),
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(root + "/feed", { waitUntil: "networkidle" });
    const avatars = page.getByRole("button", { name: /^View .*'s story$/ });
    await avatars.first().waitFor({ timeout: 15000 });
    await avatars.first().tap();
    const reply = page.getByPlaceholder("Send message");
    await reply.waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${tag}-${size.name}-open.png` });

    // Is the control inside the screen and the topmost thing where a finger lands?
    const onTop = (label, selector) => page.evaluate(({ label, selector }) => {
      const el = document.querySelector(selector);
      if (!el) return { label, ok: false, why: "missing" };
      const r = el.getBoundingClientRect();
      const inside = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
      // Five points across the control: center, and the four inner corners.
      const points = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.85], [0.8, 0.85]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
      let hit = null;
      let topmost = true;
      for (const [x, y] of points) {
        const h = document.elementFromPoint(x, y);
        if (!h || !(h === el || el.contains(h))) { topmost = false; hit = h; break; }
        hit = h;
      }
      return { label, ok: inside && topmost, inside, topmost, hit: hit ? (hit.closest("nav") ? "bottom nav" : hit.tagName.toLowerCase() + (hit.getAttribute("aria-label") ? `[${hit.getAttribute("aria-label")}]` : "")) : null, rect: [Math.round(r.top), Math.round(r.bottom)], screen: innerHeight };
    }, { label, selector });
    const checks = [
      await onTop("reply box", 'input[placeholder="Send message"]'),
      await onTop("like", 'form button[aria-label="Like"], form button[aria-label="Unlike"]'),
      await onTop("share", 'form button[aria-label="Share"]'),
      await onTop("close", 'button:has(> svg.lucide-x)'),
    ];
    const navTabs = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Primary"]');
      if (!nav) return "no nav";
      const r = nav.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && nav.contains(hit) ? "nav on top of story" : "story covers nav";
    });

    // Keyboard: focus the reply box, raise a 336px keyboard, the box must stay visible.
    let keyboardOk = null;
    let sent = false;
    let liked = false;
    if (checks[0].ok) {
      await reply.tap();
      await reply.fill("Love this fit");
      await page.evaluate((h) => window.__keyboard(h), KEYBOARD);
      await page.waitForTimeout(500);
      const box = await reply.boundingBox();
      keyboardOk = !!box && box.y >= 0 && box.y + box.height <= size.height - KEYBOARD + 1;
      await page.screenshot({ path: `${out}/${tag}-${size.name}-keyboard.png` });
      await page.getByRole("button", { name: "Send", exact: true }).tap();
      await page.getByText("Sent", { exact: true }).first().waitFor({ timeout: 5000 }).then(() => { sent = true; }).catch(() => undefined);
      await page.evaluate(() => window.__keyboard(0));
      await reply.blur();
      await page.waitForTimeout(300);
    }
    if (checks[1].ok) {
      await page.locator('form button[aria-label="Like"]').tap();
      await page.locator('form button[aria-label="Unlike"]').waitFor({ timeout: 5000 }).then(() => { liked = true; }).catch(() => undefined);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${tag}-${size.name}-liked.png` });
    }

    // Tap the right side to move on, then close.
    const author = page.locator('button[aria-label^="Open "], button[aria-label*="profile"]').first();
    const before = await author.textContent().catch(() => null);
    let advanced = null;
    const next = page.getByRole("button", { name: "Next", exact: true }).first();
    if (await next.count()) {
      const nb = await next.boundingBox();
      await page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
      await page.waitForTimeout(600);
      const afterText = await author.textContent().catch(() => null);
      advanced = afterText !== before;
    }
    let closed = false;
    const close = page.locator('button:has(> svg.lucide-x)').first();
    if (await close.count()) {
      await close.tap();
      await reply.waitFor({ state: "detached", timeout: 3000 }).then(() => { closed = true; }).catch(() => undefined);
    }

    // The share sheet (on <body>, z-50) must still open above the story.
    await avatars.first().tap();
    await reply.waitFor();
    await page.locator('form button[aria-label="Share"]').tap();
    const sheet = page.getByRole("dialog").filter({ hasNot: page.locator('input[placeholder="Send message"]') }).last();
    let shareOnTop = false;
    if (await sheet.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
      await page.waitForTimeout(500);
      const b = await sheet.boundingBox();
      shareOnTop = await page.evaluate(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && !!hit.closest('[role="dialog"]') && !hit.closest('[aria-label="Story"]');
      }, [b.x + b.width / 2, b.y + Math.min(b.height / 2, 120)]);
      await page.screenshot({ path: `${out}/${tag}-${size.name}-share.png` });
    }

    results.push({ size: size.name, checks, navTabs, keyboardOk, sent, liked, advanced, closed, shareOnTop, errors: [...new Set(errors)] });
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${out}/${tag}-report.json`, JSON.stringify({ results, writes }, null, 1));
for (const r of results) {
  console.log(`\n${r.size}: ${r.navTabs}; keyboard ${r.keyboardOk}; sent ${r.sent}; liked ${r.liked}; advanced ${r.advanced}; closed ${r.closed}; share on top ${r.shareOnTop}; errors ${r.errors.length}`);
  console.table(r.checks.map((c) => ({ control: c.label, ok: c.ok, inside: c.inside, topmost: c.topmost, hit: c.hit, rect: JSON.stringify(c.rect), screen: c.screen })));
}
console.log("writes:", JSON.stringify(writes));
if (process.env.STRICT === "1") {
  for (const r of results) {
    assert.deepEqual(r.checks.filter((c) => !c.ok).map((c) => c.label), [], r.size);
    assert.equal(r.navTabs, "story covers nav", r.size);
    assert.equal(r.keyboardOk, true, r.size);
    assert.equal(r.sent, true, r.size);
    assert.equal(r.liked, true, r.size);
    assert.equal(r.advanced, true, r.size);
    assert.equal(r.closed, true, r.size);
    assert.equal(r.shareOnTop, true, r.size);
    assert.deepEqual(r.errors, [], r.size);
  }
  console.log("story viewer check: OK");
}
