import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;
CREATE TABLE public.exclusive_tracks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artist_user_id uuid NOT NULL, title text, audio_file_url text, audio_file_path text, access_type text DEFAULT 'purchase', price_cents integer DEFAULT 0, allow_downloads boolean DEFAULT false, is_published boolean DEFAULT false);
CREATE TABLE public.exclusive_track_purchases (track_id uuid, buyer_user_id uuid, payment_status text, amount_cents integer);
CREATE TABLE public.artist_subscriptions (artist_user_id uuid, subscriber_user_id uuid, status text, current_period_end timestamptz);
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
GRANT SELECT ON storage.objects TO anon,authenticated;
`);
await db.exec(await readFile("supabase/migrations/20261114220000_locked_music.sql", "utf8"));
await db.exec(await readFile("supabase/migrations/20261124065745_free_music_listening.sql", "utf8"));
const artist = "00000000-0000-0000-0000-00000000000a";
const fan = "00000000-0000-0000-0000-00000000000b";
const cases = [
  ["free", "free", 0, true], ["free-draft", "free", 0, false],
  ["paid", "purchase", 299, true], ["legacy-zero", "purchase", 0, true],
  ["purchased", "purchase", 299, true], ["pending", "purchase", 299, true],
  ["refunded", "purchase", 299, true],
];
const ids = {};
for (const [name, access, price, published] of cases) {
  ids[name] = (await db.query("INSERT INTO exclusive_tracks(artist_user_id,title,audio_file_path,access_type,price_cents,is_published) VALUES($1,$2,$3,$4,$5,$6) RETURNING id", [artist,name,`${artist}/${name}.mp3`,access,price,published])).rows[0].id;
  await db.query("INSERT INTO storage.objects VALUES('music-private',$1)", [`${artist}/${name}.mp3`]);
}
for (const [name, status] of [["purchased","paid"],["pending","pending"],["refunded","refunded"]]) {
  await db.query("INSERT INTO exclusive_track_purchases VALUES($1,$2,$3,299)", [ids[name],fan,status]);
}
await assert.rejects(db.query("INSERT INTO exclusive_tracks(artist_user_id,access_type,price_cents,allow_downloads) VALUES($1,'free',50,false)", [artist]), /free_listening/);
await assert.rejects(db.query("INSERT INTO exclusive_tracks(artist_user_id,access_type,price_cents,allow_downloads) VALUES($1,'free',0,true)", [artist]), /free_listening/);
async function as(id, role = "authenticated") {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET ROLE ${role}`);
}
const visible = async () => (await db.query("SELECT name FROM storage.objects ORDER BY name")).rows.map((r) => r.name.split('/')[1]);
await as(fan);
assert.deepEqual(await visible(), ["free.mp3", "purchased.mp3"]);
await as(artist);
assert.equal((await visible()).length, cases.length);
await as("", "anon");
assert.deepEqual(await visible(), []);
await db.exec("RESET ROLE");
await db.query("INSERT INTO artist_subscriptions VALUES($1,$2,'active',now()+interval '1 day')", [artist,fan]);
await as(fan);
assert.equal((await visible()).length, cases.length);
await db.exec("RESET ROLE");
await db.exec("UPDATE artist_subscriptions SET current_period_end=now()-interval '1 day'");
await as(fan);
assert.deepEqual(await visible(), ["free.mp3", "purchased.mp3"]);
await db.close();
console.log("Free music database checks passed: published free playback, draft/paid denial, paid unlock, refunds, expiry, owner access and download constraints.");
