// Press-and-hold drag of a pipeline contact on a 390px touch phone.
// Checks: the card lands in the next column (auto-scrolling sideways to reach
// it), the page itself does not scroll, and the Move button still works.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { mockSupabase, signedIn, fixtures } from "./app-audit-walk.mjs";

const root = process.env.ROOT || "http://127.0.0.1:8081";
const out = process.env.OUT || "/tmp/pipeline-drag";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await signedIn(context);
  const page = await context.newPage();
  const moves = [];
  await mockSupabase(page, {
    pipeline_items: async (req) => {
      if (req.method() === "PATCH") {
        moves.push(req.postDataJSON());
        return { body: [] };
      }
      return null;
    },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root + "/pipeline");
  const card = page.locator('[data-contact-card="Amanda Hayes"]');
  await card.waitFor();
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const box = await card.boundingBox();
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const scrollBefore = await page.evaluate(() => scrollY);
  await touch("touchStart", start.x, start.y);
  await page.waitForTimeout(350);
  // Drag to the right edge and hold there so the board scrolls to the next column.
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", start.x + ((380 - start.x) * i) / 12, start.y + 4);
    await page.waitForTimeout(16);
  }
  const contacted = page.locator('[data-stage-column="Contacted"]');
  for (let i = 0; i < 80 && (await contacted.boundingBox()).x > 120; i++) {
    await touch("touchMove", 380, start.y + 4 + (i % 2));
    await page.waitForTimeout(25);
  }
  const boardScroll = await page.locator("[data-pipeline-board]").evaluate((el) => el.scrollLeft);
  assert.ok(boardScroll > 150, `board auto-scrolled sideways (scrollLeft ${boardScroll})`);
  // Settle over the Contacted column.
  const target = await page.locator('[data-stage-column="Contacted"]').boundingBox();
  const drop = { x: Math.min(370, Math.max(20, target.x + target.width / 2)), y: target.y + 120 };
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", 380 + ((drop.x - 380) * i) / 8, start.y + ((drop.y - start.y) * i) / 8);
    await page.waitForTimeout(20);
  }
  await page.screenshot({ path: `${out}/pipeline-drag-mid-390.png` });
  await touch("touchEnd", drop.x, drop.y);
  await page.waitForTimeout(500);
  assert.equal(moves.length, 1, `one move saved (${JSON.stringify(moves)})`);
  assert.equal(moves[0].stage_id, fixtures.stages[1].id, "moved to Contacted");
  assert.equal(await page.evaluate(() => scrollY), scrollBefore, "page did not scroll during the drag");
  await page.getByText("Moved to Contacted").waitFor();
  await page.screenshot({ path: `${out}/pipeline-drag-done-390.png` });

  // A quick swipe is a scroll, not a drag.
  await page.locator("[data-pipeline-board]").evaluate((el) => el.scrollTo({ left: 0 }));
  await page.waitForTimeout(300);
  const leo = await page.locator('[data-contact-card="Leo Park"]').boundingBox();
  await touch("touchStart", leo.x + 60, leo.y + 20);
  for (let i = 1; i <= 6; i++) {
    await touch("touchMove", leo.x + 60 - i * 30, leo.y + 20);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", leo.x - 120, leo.y + 20);
  await page.waitForTimeout(300);
  assert.equal(moves.length, 1, "a quick swipe does not move a contact");

  // The Move button stays as the accessible alternative.
  await page.locator("[data-pipeline-board]").evaluate((el) => el.scrollTo({ left: 0 }));
  await page.getByRole("button", { name: "Move Leo Park" }).click();
  await page.getByRole("menuitem", { name: "In Progress" }).click();
  await page.waitForTimeout(300);
  assert.equal(moves.length, 2, "Move menu saves a move");
  assert.equal(moves[1].stage_id, fixtures.stages[2].id);
  assert.deepEqual(errors, []);
  console.log("pipeline touch drag: OK", JSON.stringify({ boardScroll, moves: moves.length }));
} finally {
  await browser.close();
}
