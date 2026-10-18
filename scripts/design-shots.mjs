import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const phase = process.argv[2] || 'before';
const outDir = resolve(process.argv[3] || '/opt/cursor/artifacts/design-review');
mkdirSync(outDir, { recursive: true });

const envText = readFileSync(resolve('/workspace/.env'), 'utf8');
function envValue(name) {
  const line = envText.split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`missing ${name}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

const supabaseHost = new URL(envValue('VITE_SUPABASE_URL')).host;
const storageKey = `sb-${supabaseHost.split('.')[0]}-auth-token`;

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const now = new Date().toISOString();

const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'design-shot@example.com',
  email_confirmed_at: now,
  phone: '',
  confirmed_at: now,
  last_sign_in_at: now,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Avery Cole' },
  identities: [],
  factors: [],
  created_at: now,
  updated_at: now,
};

const session = {
  access_token: 'design-shot-access-token',
  refresh_token: 'design-shot-refresh-token',
  expires_in: 60 * 60 * 24 * 30,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  token_type: 'bearer',
  user,
};

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: USER_ID,
  display_name: 'Avery Cole',
  city: 'Los Angeles',
  city_display: 'Los Angeles',
  city_key: 'los-angeles',
  bio: 'Photographer working in portrait and print.',
  avatar_url: '/nuance/dynasty-denim.png',
  passion_seriousness: 3,
  access_level: 'level_1',
  onboarding_completed: true,
  created_at: now,
  updated_at: now,
  mindset_level: 1,
  access_status: 'active',
  onboarding_score: null,
  passed_exam: false,
  show_only_to_passed_exam: false,
  phone: null,
  social_links: null,
};

const otherProfile = {
  ...profile,
  id: '22222222-2222-4222-8222-222222222222',
  user_id: OTHER_ID,
  display_name: 'Jordan Hale',
  city: 'Chicago',
  city_display: 'Chicago',
  city_key: 'chicago',
  bio: 'Set designer.',
  avatar_url: '/nuance/legacy-necklace-silver.png',
};

const posts = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user_id: OTHER_ID,
    content: 'Print from the studio this week.',
    media_url: '/nuance/dynasty-denim.png',
    media_type: 'photo',
    post_type: 'regular',
    created_at: now,
    location: null,
    alt_text: null,
    comments_enabled: true,
    collaborators: null,
    folder_id: null,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    user_id: USER_ID,
    content: 'A square from the portfolio.',
    media_url: '/nuance/legacy-bracelet.jpg',
    media_type: 'photo',
    post_type: 'portfolio',
    created_at: now,
    location: null,
    alt_text: null,
    comments_enabled: true,
    collaborators: null,
    folder_id: null,
  },
];

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

  if (url.pathname.includes('/realtime') || url.pathname.includes('/storage/')) {
    await route.abort();
    return;
  }

  const accept = req.headers().accept || '';
  const prefer = req.headers().prefer || '';
  const wantsObject = accept.includes('vnd.pgrst.object');
  const path = url.pathname;

  if (path.includes('get_platform_stats')) {
    await fulfillJson(route, [{
      total_creators: 18,
      total_projects: 4,
      total_cities: 3,
      total_events: 2,
    }]);
    return;
  }

  if (path.includes('/post_likes') || path.includes('/post_comments') || path.includes('/favorite_friends')) {
    const count = path.includes('post_likes') ? 4 : path.includes('favorite_friends') ? 2 : 1;
    await fulfillJson(route, wantsObject ? null : [], 200, { 'content-range': `*/${count}` });
    return;
  }

  if (path.includes('/posts')) {
    const filtered = url.searchParams.get('user_id')?.includes(USER_ID)
      ? posts.filter((p) => p.user_id === USER_ID)
      : posts;
    await fulfillJson(route, wantsObject ? filtered[0] : filtered);
    return;
  }

  if (path.includes('profiles')) {
    const rows = [profile, otherProfile];
    if (wantsObject) {
      const match = url.search.includes(OTHER_ID) ? otherProfile : profile;
      await fulfillJson(route, match);
      return;
    }
    await fulfillJson(route, rows);
    return;
  }

  if (method === 'HEAD' || prefer.includes('count=exact')) {
    await fulfillJson(route, [], 200, { 'content-range': '*/0' });
    return;
  }

  if (wantsObject) {
    await fulfillJson(route, null, 406, { 'content-range': '*/0' });
    return;
  }

  await fulfillJson(route, []);
}

const browser = await chromium.launch({ headless: true });

async function shoot(name, path, { auth = false, width, height, prepare }) {
  const context = await browser.newContext({
    viewport: { width, height },
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
  if (auth) {
    await context.addInitScript(({ storageKey, session, userId }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
      localStorage.setItem(`welcome_shown_${userId}`, 'true');
    }, { storageKey, session, userId: USER_ID });
  }
  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error(`[${name}] pageerror`, err.message);
  });
  const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173';
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  if (prepare) await prepare(page);
  const file = resolve(outDir, `${phase}_${name}_${width}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  await context.close();
}

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const pages = [
  { name: 'landing', path: '/', auth: false },
  { name: 'auth', path: '/auth', auth: false },
  { name: 'feed', path: '/feed', auth: true },
  { name: 'profile', path: '/profile', auth: true },
  { name: 'directory', path: '/directory', auth: true },
  { name: 'projects', path: '/projects', auth: true },
  { name: 'messages', path: '/messages', auth: true },
];
if (phase === 'after') {
  pages.push({ name: 'explore', path: '/explore', auth: true });
}

for (const viewport of viewports) {
  for (const item of pages) {
    await shoot(item.name, item.path, { ...viewport, auth: item.auth });
  }
  await shoot('menu', '/feed', {
    ...viewport,
    auth: true,
    prepare: async (page) => {
      const menu = page.getByRole('button', { name: /menu/i }).first();
      const more = page.getByRole('button', { name: /^more$/i }).first();
      if (await menu.count() && await menu.isVisible().catch(() => false)) {
        await menu.click();
      } else if (await more.count()) {
        await more.click();
      }
      await page.waitForTimeout(700);
    },
  });
  await shoot('create', phase === 'before' ? '/feed' : '/feed', {
    ...viewport,
    auth: true,
    prepare: async (page) => {
      const create = page.getByRole('button', { name: /^create$/i }).first();
      if (await create.count() && await create.isVisible().catch(() => false)) {
        await create.click();
        await page.waitForTimeout(700);
      }
    },
  });
}

await browser.close();
console.log('done', phase);
