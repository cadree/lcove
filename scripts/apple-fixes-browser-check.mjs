import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve } from "path";

const base = process.env.SHOT_BASE || "http://127.0.0.1:8080";
const outDir = resolve(process.argv[2] || "/opt/cursor/artifacts/iphone-safari");
mkdirSync(outDir, { recursive: true });

const SHOT_USER = "00000000-0000-4000-8000-0000000000aa";
const now = new Date().toISOString();
const musicProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: SHOT_USER,
  display_name: "Maya Torres",
  spotify_artist_url: null,
  apple_music_artist_url: null,
  artist_image_url: null,
  genres: [],
  top_tracks: [],
  albums: [],
  latest_release: null,
  platform_links: [{ platform: "spotify", url: "https://open.spotify.com/artist/maya" }],
  created_at: now,
  updated_at: now,
};

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
    "access-control-expose-headers": "content-range",
    "content-type": "application/json",
    ...extra,
  };
}

async function fulfill(route, body, status = 200) {
  const method = route.request().method();
  await route.fulfill({
    status,
    headers: corsHeaders(),
    body: method === "HEAD" ? "" : JSON.stringify(body),
  });
}

async function mockSupabase(page) {
  await page.route("**/*supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (url.pathname.includes("/rpc/preview_waitlist_invite")) {
      await fulfill(route, "maya@ether.test");
      return;
    }
    if (url.pathname.includes("/auth/v1/")) {
      await fulfill(route, { message: "no session" }, 401);
      return;
    }
    if (url.pathname.includes("/realtime") || url.pathname.includes("/storage/")) {
      await route.abort();
      return;
    }
    if (url.pathname.includes("/music_profiles")) {
      const accept = request.headers().accept || "";
      await fulfill(route, accept.includes("vnd.pgrst.object") ? musicProfile : [musicProfile]);
      return;
    }
    await fulfill(route, []);
  });
}


const browser = await chromium.launch({ channel: process.env.SHOT_BROWSER || "chrome" });
try {
for (const width of [390, 820, 1280]) {
 const context = await browser.newContext({ viewport: { width, height: 900 } });
 await context.addInitScript(() => { localStorage.setItem('ether-shot-user', '1'); localStorage.setItem('welcome_shown_00000000-0000-4000-8000-0000000000aa', 'true'); });
 const page = await context.newPage();
 await mockSupabase(page);
 page.setDefaultTimeout(12000);
 await page.goto(`${base}/messages?action=new`);
 const dialog = page.getByRole('dialog');
 await dialog.getByRole('button', { name: 'Group Chat', exact: true }).click();
 await dialog.getByRole('button', { name: 'Create Group', exact: true }).click();
 await dialog.getByRole('alert').filter({ hasText: 'Pick 2 more people. Add a group name' }).waitFor();
 await page.screenshot({path: resolve(outDir, `group-${width}.png`)});
 const box = await dialog.boundingBox();
 if (box.x < 0 || box.x + box.width > width + 1) throw new Error(`dialog overflow ${width}`);
 // Simulate a reduced visual viewport; native keyboard still requires device verification.
 await page.setViewportSize({ width, height: 450 });
 await dialog.getByPlaceholder('Group name (required)').fill('Test Group');
 const action = dialog.getByRole('button', {name:'Create Group', exact:true});
 await action.scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(outDir, `keyboard-${width}.png`)});
 const bounds = await action.boundingBox();
 if (bounds.y + bounds.height > 451) throw new Error('Create action hidden');
 await page.setViewportSize({width,height:900});
 await page.goto(`${base}/feed`);
 await page.getByRole('button',{name:'Create',exact:true}).first().click();
 await page.getByRole('dialog').getByRole('button',{name:'Post',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.waitForTimeout(400);
 const text = await page.getByRole('dialog').innerText();
 if (text.includes('Novi // Note')) throw new Error('Create sheet did not close');
 await page.screenshot({path:resolve(outDir, `post-${width}.png`)});
 await page.goto(`${base}/feed`);
 await page.getByRole('button',{name:'Create',exact:true}).first().click();
 await page.getByRole('dialog').getByRole('button',{name:'Story',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.waitForTimeout(400);
 await page.screenshot({path:resolve(outDir, `story-${width}.png`)});
 for (const [route, title] of [['store?tab=my-store&action=create','Add New Item'], ['boards?action=create','Create New Board'], ['collectives?action=create','Create Collective'], ['cinema?action=create','Create Your Network']]) {
   await page.goto(`${base}/${route}`);
   await page.getByRole('dialog').getByRole('heading', {name:title, exact:true}).waitFor();
 }
 await page.goto(`${base}/projects?action=create`);
 await page.getByRole('dialog').getByRole('button',{name:'Add Role',exact:true}).click();
 const slots = page.getByPlaceholder('Slots').last();
 await slots.fill('');
 if (await slots.inputValue() !== '') throw new Error('Slots cannot be cleared');
 await slots.fill('12');
 await slots.press('Tab');
 if (await slots.inputValue() !== '12') throw new Error('Slots did not commit');
 await slots.fill('0'); await slots.press('Tab');
 if (await slots.inputValue() !== '1') throw new Error('Slots minimum not enforced on blur');
 await page.goto(`${base}/profile`);
 await page.getByRole('button',{name:'Edit Layout',exact:true}).click();
 const sizes = page.getByRole('combobox', {name:/Size of/});
 await sizes.first().selectOption('large');
 if (await sizes.first().inputValue() !== 'large') throw new Error('Layout size control failed');
 const layoutHeading = page.getByRole('heading',{name:'Edit Layout',exact:true});
 await layoutHeading.waitFor();
 const headingBounds = await layoutHeading.boundingBox();
 if (headingBounds.y < 0 || headingBounds.y > 100) throw new Error('Layout header is outside viewport');
 await page.waitForTimeout(400);
 await page.screenshot({path:resolve(outDir, `layout-${width}.png`)});
 console.log(`PASS group validation, reduced viewport, Post/Story, create links, number drafts, layout controls at ${width}px`);
 await context.close();
}
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage(); await mockSupabase(page);
await page.goto(`${base}/auth?invite=shot-invite`);
await page.locator('#terms-accepted').waitFor();
if (await page.locator('#terms-accepted').isChecked()) throw new Error('Terms checked by default');
if (await page.locator('button[type=submit]').isEnabled()) throw new Error('Signup enabled before consent');
await page.locator('#terms-accepted').check();
if (!(await page.locator('button[type=submit]').isEnabled())) throw new Error('Signup stays disabled after consent');
await page.screenshot({path:resolve(outDir,'signup-390.png')});
console.log('PASS signup explicit consent');
await context.close();
} finally { await browser.close(); }
