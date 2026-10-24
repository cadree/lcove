import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "/opt/cursor/artifacts/event-share";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (msg) => console.log("console", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("pageerror", err.message));
await page.goto("http://127.0.0.1:8080/preview/hosting", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
console.log("url", page.url());
console.log(await page.locator("body").innerText());
await page.screenshot({ path: `${OUT}/debug.png`, fullPage: true });
await page.getByRole("heading", { name: "Listening night" }).waitFor();
await page.getByText("Powered by Ether").waitFor();
await page.getByRole("button", { name: "Buy tickets from $20.91" }).waitFor();
await page.screenshot({ path: `${OUT}/signed-out-landing.png`, fullPage: true });

await page.goto("http://127.0.0.1:8080/preview/hosting?screen=host", { waitUntil: "networkidle" });
const bar = page.getByTestId("host-share-bar");
await bar.waitFor();
await bar.scrollIntoViewIfNeeded();
await bar.getByRole("button", { name: "Copy link" }).waitFor();
await bar.getByRole("button", { name: "Share" }).waitFor();
await page.screenshot({ path: `${OUT}/share-button.png`, fullPage: true });
await bar.screenshot({ path: `${OUT}/share-button-bar.png` });

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desktop.goto("http://127.0.0.1:8080/preview/hosting?screen=host", { waitUntil: "networkidle" });
await desktop.getByTestId("host-share-bar").waitFor();
await desktop.screenshot({ path: `${OUT}/share-button-desktop.png`, fullPage: true });
await desktop.getByTestId("host-share-bar").screenshot({ path: `${OUT}/share-button-desktop-bar.png` });
await desktop.goto("http://127.0.0.1:8080/preview/hosting", { waitUntil: "networkidle" });
await desktop.getByRole("heading", { name: "Listening night" }).waitFor();
await desktop.screenshot({ path: `${OUT}/signed-out-landing-desktop.png`, fullPage: true });

const card = `<!doctype html><meta charset="utf-8"><title>Unfurl check</title>
<style>
  body{margin:0;background:#0e0e12;color:#fff;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{width:520px;background:#16161c;border-radius:18px;overflow:hidden;border:1px solid #2a2a33}
  img{width:100%;height:273px;object-fit:cover;display:block}
  .body{padding:16px 18px 18px}
  .host{font:12px/1.4 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#ffb3d1}
  h1{margin:6px 0 8px;font-size:28px}
  p{margin:0;font:14px/1.4 system-ui,sans-serif;color:#c8c8d0}
</style>
<div class="card">
  <img src="flyer.jpg" alt="Listening night flyer">
  <div class="body">
    <div class="host">Ada Lane</div>
    <h1>Listening night</h1>
    <p>Ada Lane · Sun, Nov 1 · 6:00 PM · The loft</p>
  </div>
</div>`;
writeFileSync(`${OUT}/unfurl.html`, card);
const preview = await browser.newPage({ viewport: { width: 640, height: 480 } });
await preview.goto(`file://${OUT}/unfurl.html`);
await preview.screenshot({ path: `${OUT}/unfurl-preview.png` });
await browser.close();
console.log("shots ok");
