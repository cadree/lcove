import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import jsQR from 'jsqr';
import { Image } from 'imagescript';

const outDir = resolve(process.argv[2] || '/opt/cursor/artifacts/ether-id');
mkdirSync(outDir, { recursive: true });

const envText = readFileSync(resolve('/workspace/.env'), 'utf8');
function envValue(name) {
  const line = envText.split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`missing ${name}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

const supabaseHost = new URL(envValue('VITE_SUPABASE_URL')).host;
const storageKey = `sb-${supabaseHost.split('.')[0]}-auth-token`;
const USER_ID = '00000000-0000-4000-8000-0000000000aa';
const now = new Date().toISOString();
const ACTIVE_TOKEN = 'eid1.aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.1893456000.sig';
const BANNED_TOKEN = 'eid1.bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.1893456000.banned';

const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'maya@example.com',
  email_confirmed_at: now,
  phone: '',
  confirmed_at: now,
  last_sign_in_at: now,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Maya Torres' },
  identities: [],
  factors: [],
  created_at: now,
  updated_at: now,
};

const session = {
  access_token: 'ether-id-shot-access-token',
  refresh_token: 'ether-id-shot-refresh-token',
  expires_in: 60 * 60 * 24 * 30,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  token_type: 'bearer',
  user,
};

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: USER_ID,
  display_name: 'Maya Torres',
  city: 'Los Angeles',
  city_display: 'Los Angeles',
  city_key: 'los-angeles',
  bio: 'Photographer working in portrait and print.',
  avatar_url: '/nuance/dynasty-denim.png',
  passion_seriousness: 3,
  access_level: 'level_1',
  onboarding_completed: true,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: now,
  mindset_level: 1,
  access_status: 'active',
  onboarding_score: null,
  passed_exam: true,
  show_only_to_passed_exam: false,
  phone: null,
  social_links: null,
  founding: false,
  username: 'maya',
  birthday_month: 3,
  birthday_day: 4,
  show_birthday: true,
};

let shotStatus = 'Active';

const ownerCard = {
  display_name: 'Maya Torres',
  username: 'maya',
  avatar_url: '/ether-id/shot-portrait.jpg',
  photo_url: '/ether-id/shot-portrait.jpg',
  id_photo_url: null,
  city: 'Los Angeles',
  status: 'Active',
  member_since: '2026-10-01',
  member_since_label: 'October 2026',
  passion: 'Photography',
  peer_review_average: 4.5,
  peer_review_count: 2,
  peer_review_label: '4.5 average · 2 reviews',
  projects_completed: 2,
  projects_label: '2 completed',
  birthday_label: 'March 4',
  birthday_note: 'self-reported',
  show_birthday: true,
  birthday_month: 3,
  birthday_day: 4,
  token: ACTIVE_TOKEN,
  verify_path: `/id/v/${ACTIVE_TOKEN}`,
};

function publicCard(status) {
  return {
    display_name: 'Maya Torres',
    username: 'maya',
    avatar_url: '/ether-id/shot-portrait.jpg',
    photo_url: '/ether-id/shot-portrait.jpg',
    status,
    member_since: '2026-10-01',
    member_since_label: 'October 2026',
  };
}

function corsHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
    'access-control-expose-headers': 'content-range',
    'content-type': 'application/json',
    ...extra,
  };
}

async function fulfillJson(route, body, status = 200, extra = {}) {
  const method = route.request().method();
  await route.fulfill({
    status,
    headers: corsHeaders(extra),
    body: method === 'HEAD' ? '' : JSON.stringify(body),
  });
}

async function handleSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }

  if (url.pathname.includes('/auth/v1/')) {
    if (url.pathname.endsWith('/user')) {
      await fulfillJson(route, user);
      return;
    }
    await fulfillJson(route, { ...session, user });
    return;
  }

  if (url.pathname.includes('/functions/v1/ether-id-pass')) {
    await fulfillJson(route, { configured: false });
    return;
  }

  if (url.pathname.includes('/rpc/get_my_ether_id')) {
    await fulfillJson(route, { ...ownerCard, status: shotStatus });
    return;
  }

  if (url.pathname.includes('/rpc/get_ether_id_by_token')) {
    let token = '';
    try {
      token = JSON.parse(req.postData() || '{}').p_token || '';
    } catch {
      token = '';
    }
    if (token === BANNED_TOKEN) {
      await fulfillJson(route, publicCard('Banned'));
      return;
    }
    if (token === ACTIVE_TOKEN) {
      await fulfillJson(route, publicCard('Active'));
      return;
    }
    await fulfillJson(route, null);
    return;
  }

  if (url.pathname.includes('/realtime') || url.pathname.includes('/storage/')) {
    await route.abort();
    return;
  }

  const accept = req.headers().accept || '';
  const prefer = req.headers().prefer || '';
  const wantsObject = accept.includes('vnd.pgrst.object');
  const path = url.pathname;

  if (path.includes('/profiles')) {
    await fulfillJson(route, wantsObject ? profile : [profile]);
    return;
  }

  if (method === 'HEAD' || prefer.includes('count=exact')) {
    await fulfillJson(route, [], 200, { 'content-range': '*/0' });
    return;
  }

  if (wantsObject) {
    await fulfillJson(route, null, 200, { 'content-range': '*/0' });
    return;
  }

  await fulfillJson(route, []);
}

const browser = await chromium.launch({ headless: true });
const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173';

async function shoot(name, path, assertPage, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  if (typeof context.routeWebSocket === 'function') {
    await context.routeWebSocket(/.*/, (ws) => ws.close());
  }
  await context.route('**/*', async (route) => {
    const host = new URL(route.request().url()).host;
    if (host === supabaseHost || host.endsWith('supabase.co')) {
      await handleSupabase(route);
      return;
    }
    await route.continue();
  });
  await context.addInitScript(({ storageKey, session, userId }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem(`welcome_shown_${userId}`, 'true');
  }, { storageKey, session, userId: USER_ID });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById('boot-splash'), { timeout: 8000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '.ether-id-float{animation:none !important}.ether-id-pulse{animation:none !important;opacity:.8}',
  });
  await assertPage(page);
  const wallet = page.getByRole('button', { name: 'Add to Apple Wallet' });
  if (await wallet.count()) {
    throw new Error(`${name}: Apple Wallet button is visible without secrets`);
  }
  const file = resolve(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  if (errors.length) console.error(`[${name}] pageerror`, errors.join('\n'));
  await context.close();
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: 'visible', timeout: 15000 });
}

async function expectCard(page, status, name) {
  await expectText(page, 'FAMILCY');
  await expectText(page, 'TORRES, MAYA');
  await expectText(page, '@maya');
  await expectText(page, 'Photography');
  await expectText(page, '4.5/2');
  await expectText(page, 'Projects');
  await expectText(page, '03.04');
  await expectText(page, 'self-reported');
  await expectText(page, 'Los Angeles');
  await expectText(page, status);
  await expectText(page, 'This is not age verification.');
  const photo = page.locator('img[data-photo]');
  await photo.waitFor({ state: 'visible', timeout: 15000 });
  await photo.evaluate((img) => img.complete && img.naturalWidth > 0 ? true : new Promise((resolve, reject) => {
    img.addEventListener('load', () => resolve(true), { once: true });
    img.addEventListener('error', () => reject(new Error('photo failed')), { once: true });
  }));
  await page.locator('img[data-novi]').waitFor({ state: 'visible', timeout: 15000 });
  const familcy = await page.locator('article.ether-id').innerText();
  const mentions = familcy.match(/FAMILCY/g) || [];
  if (mentions.length !== 1) throw new Error(`FAMILCY appears ${mentions.length} times`);
  await assertNoOverlap(page);
  const card = page.locator('.ether-id-slot');
  await card.screenshot({ path: resolve(outDir, `${name}-card.png`) });
}

async function assertNoOverlap(page) {
  const hits = await page.locator('article.ether-id').evaluate((article) => {
    const nodes = [...article.querySelectorAll('[data-plate]')];
    const boxes = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        name: `${node.getAttribute('data-plate')}:${(node.innerText || '').replace(/\s+/g, ' ').slice(0, 32)}`,
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        node,
      };
    });
    const contains = (a, b) => a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.w + 1 >= b.x + b.w && a.y + a.h + 1 >= b.y + b.h;
    const clashes = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (contains(a, b) || contains(b, a)) continue;
        const iw = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const ih = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (iw > 2 && ih > 2) clashes.push(`${a.name} ∩ ${b.name} ${Math.round(iw)}x${Math.round(ih)}`);
      }
    }
    const plate = article.getBoundingClientRect();
    const outside = boxes
      .filter((box) => box.x < plate.x - 2 || box.y < plate.y - 2 || box.x + box.w > plate.x + plate.w + 2 || box.y + box.h > plate.y + plate.h + 2)
      .map((box) => box.name);
    const overflow = nodes
      .filter((node) => node.getAttribute('data-plate') !== 'photo' && node.getAttribute('data-plate') !== 'novi')
      .filter((node) => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2)
      .map((node) => `${node.getAttribute('data-plate')}:${(node.innerText || '').slice(0, 24)}`);
    const slot = article.closest('.ether-id-slot')?.getBoundingClientRect();
    const fit = slot ? Math.abs(plate.width - slot.width) : 0;
    return { clashes, outside, overflow, fit, plate: { w: plate.width, h: plate.height }, slot: slot ? { w: slot.width, h: slot.height } : null };
  });
  if (hits.clashes.length || hits.outside.length || hits.overflow.length || hits.fit > 4) {
    throw new Error(`plate layout\n${JSON.stringify(hits, null, 2)}`);
  }
}

async function tiltFrames(page) {
  const tilt = page.locator('.ether-id-tilt');
  const slot = page.locator('.ether-id-slot');
  const frames = [
    ['tilt-rest', '0', '0'],
    ['tilt-left', '8', '-12'],
    ['tilt-right', '-10', '12'],
  ];
  for (const [name, rx, ry] of frames) {
    await tilt.evaluate((node, angles) => {
      node.style.setProperty('--rx', `${angles.rx}deg`);
      node.style.setProperty('--ry', `${angles.ry}deg`);
    }, { rx, ry });
    await page.waitForTimeout(60);
    const box = await slot.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('slot missing for tilt frame');
    const padX = 28;
    const padY = 36;
    const x = Math.max(0, box.x - padX);
    const y = Math.max(0, box.y - padY);
    await page.screenshot({
      path: resolve(outDir, `${name}.png`),
      clip: {
        x,
        y,
        width: Math.min(viewport.width - x, box.width + padX * 2),
        height: Math.min(viewport.height - y, box.height + padY * 2),
      },
    });
  }
  await tilt.evaluate((node) => {
    node.style.setProperty('--rx', '0deg');
    node.style.setProperty('--ry', '0deg');
  });
}

async function scanQr(page) {
  const qr = page.getByTestId('ether-id-qr');
  await qr.waitFor({ state: 'visible', timeout: 15000 });
  const box = await qr.boundingBox();
  if (!box) throw new Error('qr box missing');
  const png = await page.screenshot({
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: box.width,
      height: box.height,
    },
  });
  const image = await Image.decode(png);
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  for (let y = 1; y <= image.height; y += 1) {
    for (let x = 1; x <= image.width; x += 1) {
      const pixel = image.getPixelAt(x, y) >>> 0;
      const i = ((y - 1) * image.width + (x - 1)) * 4;
      data[i] = (pixel >>> 24) & 255;
      data[i + 1] = (pixel >>> 16) & 255;
      data[i + 2] = (pixel >>> 8) & 255;
      data[i + 3] = pixel & 255;
    }
  }
  const code = jsQR(data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
  const expected = `${base}/id/v/${ACTIVE_TOKEN}`;
  if (!code || code.data !== expected) {
    writeFileSync(resolve(outDir, 'qr-fail.png'), png);
    throw new Error(`QR decoded ${code?.data || 'nothing'} (${image.width}x${image.height}), expected ${expected}`);
  }
  console.log('qr ok', code.data);
}

shotStatus = 'Active';
await shoot('card-active-390', '/id', async (page) => {
  await expectCard(page, 'Active', 'card-active-390');
  await scanQr(page);
});

shotStatus = 'Banned';
await shoot('card-banned-390', '/id', async (page) => {
  await expectCard(page, 'Banned', 'card-banned-390');
  const body = await page.locator('article.ether-id').innerText();
  if (!/banned/i.test(body)) throw new Error('banned card did not say Banned');
});

shotStatus = 'Active';
await shoot('card-active-768', '/id', async (page) => {
  await expectCard(page, 'Active', 'card-active-768');
}, { width: 768, height: 1024 });

shotStatus = 'Banned';
await shoot('card-banned-768', '/id', async (page) => {
  await expectCard(page, 'Banned', 'card-banned-768');
}, { width: 768, height: 1024 });

shotStatus = 'Active';
await shoot('card-active-desktop', '/id', async (page) => {
  await expectCard(page, 'Active', 'card-active-desktop');
  await tiltFrames(page);
}, { width: 1280, height: 900 });

shotStatus = 'Banned';
await shoot('card-banned-desktop', '/id', async (page) => {
  await expectCard(page, 'Banned', 'card-banned-desktop');
}, { width: 1280, height: 900 });

shotStatus = 'Active';

await shoot('profile-entry', '/profile', async (page) => {
  const entry = page.getByRole('link', { name: /Show my ID/i });
  await entry.waitFor({ state: 'visible', timeout: 15000 });
  await entry.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const box = await entry.boundingBox();
  if (!box || box.y < 48 || box.y + box.height > 796) {
    throw new Error(`Show my ID is outside the 390x844 shot: ${JSON.stringify(box)}`);
  }
});

await shoot('verify-active', `/id/v/${ACTIVE_TOKEN}`, async (page) => {
  await expectText(page, 'TORRES, MAYA');
  await expectText(page, '@maya');
  await expectText(page, 'Active');
  await expectText(page, '2026.10.01');
  const body = await page.locator('body').innerText();
  if (body.includes('March 4') || body.includes('4.5') || body.includes('Photography') || body.includes('2 completed')) {
    throw new Error(`verify-active leaked private fields:\n${body}`);
  }
});

await shoot('verify-banned', `/id/v/${BANNED_TOKEN}`, async (page) => {
  await expectText(page, 'Banned');
  await expectText(page, 'TORRES, MAYA');
  const body = await page.locator('body').innerText();
  if (body.includes('March 4') || body.includes('Active')) {
    throw new Error(`verify-banned showed a stale or private field:\n${body}`);
  }
});

await browser.close();
console.log('ether id shots ok');
