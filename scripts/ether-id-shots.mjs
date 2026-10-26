import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

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

const ownerCard = {
  display_name: 'Cadre Wallace',
  username: 'cadre',
  avatar_url: null,
  status: 'Active',
  member_since: '2026-10-01',
  member_since_label: 'October 2026',
  passion: 'Creative Director',
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
  member_of: null,
  city: 'Los Angeles',
  token: ACTIVE_TOKEN,
  verify_path: `/id/v/${ACTIVE_TOKEN}`,
};

function publicCard(status) {
  return {
    display_name: 'Maya Torres',
    username: 'maya',
    avatar_url: '/nuance/dynasty-denim.png',
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
    await fulfillJson(route, ownerCard);
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

async function shoot(name, path, assertPage) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
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

await shoot('card', '/id', async (page) => {
  await expectText(page, 'Wallace');
  await expectText(page, 'Cadre');
  await expectText(page, '@cadre');
  await expectText(page, 'Creative Director');
  await expectText(page, '4.5 · 2');
  await expectText(page, 'LCOVE');
  await expectText(page, 'Los Angeles');
  await expectText(page, 'Oct 2026');
  await expectText(page, 'familcy access // member id');
  await expectText(page, 'Active');
  await expectText(page, 'This is not age verification.');
  const card = page.getByTestId('ether-id-card');
  await card.waitFor({ state: 'visible', timeout: 15000 });
  const body = await page.locator('body').innerText();
  if (body.includes('ETR.9XC3') || /ID ETR\./.test(body)) {
    throw new Error('card printed a member code in the footer');
  }
  await page.locator('[data-testid="ether-id-qr"] svg').waitFor({ state: 'visible', timeout: 15000 });
});

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
  await expectText(page, 'Maya Torres');
  await expectText(page, '@maya');
  await expectText(page, 'Active');
  await expectText(page, 'October 2026');
  const body = await page.locator('body').innerText();
  if (body.includes('March 4') || body.includes('4.5') || body.includes('Photography') || body.includes('2 completed')) {
    throw new Error(`verify-active leaked private fields:\n${body}`);
  }
});

await shoot('verify-banned', `/id/v/${BANNED_TOKEN}`, async (page) => {
  await expectText(page, 'Banned');
  await expectText(page, 'Maya Torres');
  const body = await page.locator('body').innerText();
  if (body.includes('March 4') || body.includes('Active')) {
    throw new Error(`verify-banned showed a stale or private field:\n${body}`);
  }
});

await browser.close();
console.log('ether id shots ok');
