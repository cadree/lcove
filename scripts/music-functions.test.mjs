// Exercise the deployed handlers with boundary fakes. No Stripe accounts,
// purchases, real users, or email deliveries are created by these tests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { musicPayoutUrls } from '../supabase/functions/_shared/payout-urls.mjs';
import { canDownloadMusic } from '../supabase/functions/_shared/music-download.mjs';
import { assertStripeTestKey } from '../supabase/functions/_shared/stripe-mode.mjs';
import { httpStatusForError } from '../supabase/functions/_shared/http-error.mjs';

async function load(name, mocks) {
  let handler;
  const source = (await readFile(`supabase/functions/${name}/index.ts`, 'utf8')).replace(/^import .*;\n/gm, '');
  const { code } = await transform(source, { loader: 'ts' });
  const bindings = { serve: fn => { handler = fn; }, musicPayoutUrls, canDownloadMusic, assertStripeTestKey, httpStatusForError, ...mocks };
  new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  return handler;
}
const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'secret-placeholder', STRIPE_SECRET_KEY: 'sk_test_placeholder' };
const Deno = { env: { get: name => env[name] } };
let profile = { stripe_connect_account_id: 'acct_existing' };
let linkCalls = [], accountsCreated = 0;
const createClient = () => ({ auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'artist', email: 'qa@example.invalid' } : null }, error: token === 'valid' ? null : new Error('Invalid token') }) }, from: () => {
  const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: profile }), update: () => ({ eq: async () => ({ error: null }) }) }; return chain;
} });
class Stripe {
  accounts = { create: async () => { accountsCreated++; return { id: 'acct_new' }; } };
  accountLinks = { create: async data => {
    assert.equal(new URL(data.return_url).protocol, 'https:');
    assert.equal(new URL(data.refresh_url).protocol, 'https:');
    linkCalls.push(data); return { url: 'https://connect.stripe.com/setup/test' };
  } };
}
const onboard = await load('create-music-payout-account', { createClient, Stripe, Deno });
for (const origin of [undefined, 'capacitor://localhost', 'https://localhost', 'https://etherbylcove.com']) {
  const headers = { Authorization: 'Bearer valid' };
  if (origin) headers.Origin = origin;
  const res = await onboard(new Request('https://example.invalid', { method: 'POST', headers }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).accountId, 'acct_existing');
}
assert.equal(accountsCreated, 0);
assert.equal(linkCalls.length, 4);
assert.equal((await onboard(new Request('https://example.invalid', { method: 'POST' }))).status, 401);
profile = null;
assert.equal((await onboard(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer valid' } }))).status, 500);
assert.equal(accountsCreated, 0);

const trackId = '00000000-0000-0000-0000-000000000001';
let track = { id: trackId, title: 'Song', artist_user_id: 'artist', audio_file_path: 'artist/song.flac', access_type: 'purchase', allow_downloads: true };
let purchase = { track_id: trackId, buyer_user_id: 'fan', payment_status: 'paid', amount_cents: 50 };
let signed = 0;
const client = {
  auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'fan' } : null }, error: null }) },
  from: table => {
    const chain = { select: () => chain, eq: () => chain, gt: () => chain,
      maybeSingle: async () => ({ data: track }), limit: async () => ({ data: purchase ? [purchase] : [] }) };
    assert.ok(['exclusive_tracks', 'exclusive_track_purchases'].includes(table)); return chain;
  },
  storage: { from: bucket => ({ createSignedUrl: async (path, ttl, options) => {
    signed++; assert.equal(bucket, 'music-private'); assert.equal(path, 'artist/song.flac'); assert.equal(ttl, 60); assert.equal(options.download, 'Song.flac');
    return { data: { signedUrl: 'https://project.supabase.co/signed' } };
  } }) },
};
const download = await load('download-music-track', { createClient: () => client, Deno });
const request = (authorized = true) => new Request('https://example.invalid', { method: 'POST', headers: authorized ? { Authorization: 'Bearer valid' } : {}, body: JSON.stringify({ track_id: trackId, buyer_user_id: 'someone-else' }) });
assert.equal((await download(request())).status, 200);
assert.equal(signed, 1);
for (const status of ['pending','refunded','failed','expired']) {
  purchase = { ...purchase, payment_status: status };
  assert.equal((await download(request())).status, 403);
}
purchase = { ...purchase, payment_status: 'paid' };
track = { ...track, access_type: 'free' };
assert.equal((await download(request())).status, 403);
track = { ...track, access_type: 'purchase', allow_downloads: false };
assert.equal((await download(request())).status, 403);
assert.equal((await download(request(false))).status, 401);
assert.equal(signed, 1);
console.log('Music handlers passed: native payout links, existing-account reuse, authentication, missing-profile failure, paid downloads and denied unpaid/free downloads.');
