// Rebuilds the posts table and policies from the migrations, applies
// 20261114150000_video_covers_and_post_drafts.sql, and checks that drafts are
// owner-only and that the rollback restores the previous shape.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated, anon;
 GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
 CREATE TABLE public.ether_schema_migrations(version text PRIMARY KEY);
 CREATE TABLE public.user_roles(user_id uuid, role text);
 CREATE FUNCTION public.has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role=r) $$;
 CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
 CREATE FUNCTION public.either_blocked(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_blocks WHERE (blocker_id=a AND blocked_id=b) OR (blocker_id=b AND blocked_id=a)) $$;
 CREATE TABLE public.posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, content text, media_url text, media_type text, post_type text NOT NULL DEFAULT 'regular', hidden_at timestamptz, removed_at timestamptz, created_at timestamptz DEFAULT now());
 ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
 GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
 INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b'), ('00000000-0000-4000-8000-00000000000c');
 INSERT INTO public.user_roles VALUES ('00000000-0000-4000-8000-00000000000c', 'admin');
`);
const consumer = await readFile("supabase/migrations/20261024130000_anon_consumer_access.sql", "utf8");
const start = consumer.indexOf('DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;');
await db.exec(consumer.slice(start, consumer.indexOf('DROP POLICY IF EXISTS "Anyone can view comments"', start)));
await db.exec(`CREATE POLICY "Users can create own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);`);

const migration = await readFile("supabase/migrations/20261114150000_video_covers_and_post_drafts.sql", "utf8");
await db.exec(migration);
await db.exec(`INSERT INTO public.ether_schema_migrations VALUES ('20261114150000_video_covers_and_post_drafts.sql');`);
await db.exec(migration); // idempotent re-run

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-00000000000c";
async function as(user, sql, params = []) {
  await db.exec(`RESET ROLE; SET ROLE ${user ? "authenticated" : "anon"}; SELECT set_config('request.jwt.claim.sub', '${user ?? ""}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("RESET ROLE;"); }
}

// A saves a video draft with a cover, B and admins cannot see or touch it.
const saved = await as(A, `INSERT INTO public.post_drafts(content, media_url, media_type, thumbnail_url) VALUES ('wip', 'https://x/v.mp4', 'video', 'https://x/c.jpg') RETURNING id, user_id`);
const draftId = saved.rows[0].id;
assert.equal(saved.rows[0].user_id, A, "user_id defaults to the signed-in owner");
assert.equal((await as(A, "SELECT * FROM public.post_drafts")).rows.length, 1);
assert.equal((await as(B, "SELECT * FROM public.post_drafts")).rows.length, 0, "other members cannot read drafts");
assert.equal((await as(ADMIN, "SELECT * FROM public.post_drafts")).rows.length, 0, "admins cannot read drafts");
await assert.rejects(as(null, "SELECT * FROM public.post_drafts"), /permission denied/, "anon has no access");
assert.equal((await as(B, "UPDATE public.post_drafts SET content='hijack' RETURNING id")).rows.length, 0);
assert.equal((await as(B, "DELETE FROM public.post_drafts RETURNING id")).rows.length, 0);
await assert.rejects(as(B, `INSERT INTO public.post_drafts(user_id, content) VALUES ('${A}', 'spoof')`), /row-level security/);
const moved = await as(A, `UPDATE public.post_drafts SET user_id='${B}' WHERE id='${draftId}' RETURNING user_id`);
assert.equal(moved.rows[0].user_id, A, "a draft cannot be handed to someone else");
await assert.rejects(as(A, `INSERT INTO public.post_drafts(media_type) VALUES ('audio')`), /check constraint/);

// Drafts are not posts: nothing reaches feeds until A publishes.
assert.equal((await as(B, "SELECT * FROM public.posts")).rows.length, 0);
await as(A, `INSERT INTO public.posts(user_id, content, media_url, media_type, thumbnail_url) SELECT user_id, content, media_url, media_type, thumbnail_url FROM public.post_drafts WHERE id='${draftId}'`);
await as(A, `DELETE FROM public.post_drafts WHERE id='${draftId}'`);
const seen = await as(B, "SELECT media_type, thumbnail_url FROM public.posts");
assert.deepEqual(seen.rows, [{ media_type: "video", thumbnail_url: "https://x/c.jpg" }], "published post with its cover is visible");
assert.equal((await as(A, "SELECT * FROM public.post_drafts")).rows.length, 0);

// Rollback restores the previous shape.
await db.exec(await readFile("supabase/rollbacks/20261114150000_video_covers_and_post_drafts.down.sql", "utf8"));
const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='posts' AND column_name='thumbnail_url'`);
assert.equal(cols.rows.length, 0);
assert.equal((await db.query(`SELECT to_regclass('public.post_drafts') AS t`)).rows[0].t, null);
assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.ether_schema_migrations`)).rows[0].n, 0);
console.log("post drafts db: OK");
