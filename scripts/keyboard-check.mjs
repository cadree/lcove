// Simulates the iPhone keyboard at 390px: the visual viewport shrinks by the
// keyboard height while the layout viewport stays full height (iOS Safari).
// Every checked field must end up inside the visible part of the screen.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { mockSupabase, signedIn } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const out = process.env.OUT || "/tmp/keyboard-check";
const KEYBOARD = 336;
mkdirSync(out, { recursive: true });

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

const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await signedIn(context);
  await context.addInitScript(fakeViewport);
  const page = await context.newPage();
  await mockSupabase(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const visibleArea = () => page.evaluate(() => ({ top: visualViewport.offsetTop, bottom: visualViewport.offsetTop + visualViewport.height }));
  async function check(name, locator, opts = {}) {
    await locator.focus();
    await page.evaluate((h) => window.__keyboard(h), KEYBOARD);
    await page.waitForTimeout(1100);
    const box = await locator.boundingBox();
    const area = await visibleArea();
    const ok = box && box.y >= area.top - 1 && box.y + box.height <= area.bottom + 1;
    results.push({ name, ok, field: box && { top: Math.round(box.y), bottom: Math.round(box.y + box.height) }, visible: area });
    await page.screenshot({ path: `${out}/${name}-390.png` });
    await page.evaluate(() => window.__keyboard(0));
    if (!opts.keepFocus) await locator.blur();
    await page.waitForTimeout(200);
  }

  // Chat composer (fixed full-height thread).
  await page.goto(root + "/messages");
  await page.getByText("See you after the mixer.").first().click();
  await check("chat-composer", page.getByPlaceholder(/message/i).last());

  // Dialog: the last field of Add contact on the pipeline.
  await page.goto(root + "/pipeline");
  await page.getByRole("button", { name: /add contact/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const fields = dialog.locator("input:not([type=hidden]):not([type=file]), textarea");
  await check("dialog-last-field", fields.last());

  // Long page form: the last text field in Settings.
  await page.goto(root + "/settings");
  await page.waitForTimeout(800);
  const pageFields = page.locator("main input[type=text], main input:not([type]), main textarea, input[type=text], textarea");
  await check("settings-last-field", pageFields.last());

  // Create post caption sheet.
  await page.goto(root + "/feed");
  await page.waitForTimeout(1200);
  const prompt = page.getByText("What's on your mind?").first();
  if (await prompt.count()) await prompt.click();
  await page.waitForTimeout(400);
  const caption = page.locator("textarea").first();
  if (await caption.count()) await check("feed-composer", caption);

  console.log(JSON.stringify(results));
  console.table(results.map((r) => ({ name: r.name, ok: r.ok, field: JSON.stringify(r.field), visible: JSON.stringify(r.visible) })));
  assert.deepEqual(results.filter((r) => !r.ok).map((r) => r.name), []);
  assert.deepEqual(errors, []);
  console.log("keyboard check: OK");
} finally {
  await browser.close();
}
