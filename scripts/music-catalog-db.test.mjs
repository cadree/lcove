// Music catalog migration on a throwaway Postgres (PGlite): owner-only writes,
// public reads, draft placements hidden, no mixing of two artists' catalogs.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
 CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
`);
// The real exclusive_tracks table and its RLS, from the migration that made it.
const tracksSql = await readFile("supabase/migrations/20260415041849_3a1780d7-d09f-4ca8-9839-cae2a655928d.sql", "utf8");
await db.exec(tracksSql.slice(0, tracksSql.indexOf("CREATE POLICY \"Artists can delete their own tracks\"")) +
  `CREATE POLICY "Artists can delete their own tracks" ON public.exclusive_tracks FOR DELETE TO authenticated USING (artist_user_id = auth.uid());
   GRANT SELECT ON public.exclusive_tracks TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON public.exclusive_tracks TO authenticated;`);
const migration = await readFile("supabase/migrations/20261115100000_music_catalog.sql", "utf8");
await db.exec(migration);
// Applying twice must be harmless (the apply file may be re-run after a partial failure).
await db.exec(migration);

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
for (const id of [A, B]) {
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  await db.query("INSERT INTO public.profiles VALUES($1)", [id]);
}
const pub = (await db.query("INSERT INTO public.exclusive_tracks(artist_user_id,title,is_published) VALUES($1,'Meaningful',true) RETURNING id", [A])).rows[0].id;
const draft = (await db.query("INSERT INTO public.exclusive_tracks(artist_user_id,title,is_published) VALUES($1,'Draft',false) RETURNING id", [A])).rows[0].id;
const bTrack = (await db.query("INSERT INTO public.exclusive_tracks(artist_user_id,title,is_published) VALUES($1,'Other',true) RETURNING id", [B])).rows[0].id;

let checks = 0;
const ok = (label) => console.log(`ok ${++checks} - ${label}`);
async function as(role, id = "") {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET ROLE ${role}`);
}
const q = async (sql, args = []) => (await db.query(sql, args)).rows;

await as("authenticated", A);
const [albums] = await q("INSERT INTO public.music_sections(user_id,title,position) VALUES($1,'Albums',0) RETURNING id", [A]);
const [mixes] = await q("INSERT INTO public.music_sections(user_id,title,position) VALUES($1,'DJ Mixes',1) RETURNING id", [A]);
ok("owner creates sections");
await q("INSERT INTO public.music_section_items(section_id,user_id,item_key,position) VALUES($1,$2,'release:music.apple.com/us/album/x/1',0)", [albums.id, A]);
await q("INSERT INTO public.music_section_items(section_id,user_id,item_key,exclusive_track_id,position) VALUES($1,$2,$3,$4,1)", [albums.id, A, `track:${pub}`, pub]);
await q("INSERT INTO public.music_section_items(section_id,user_id,item_key,exclusive_track_id,position) VALUES($1,$2,$3,$4,0)", [mixes.id, A, `track:${draft}`, draft]);
ok("owner places releases, a published track and a draft track");
await q("UPDATE public.music_sections SET title='Mixtapes', position=0 WHERE id=$1", [mixes.id]);
assert.equal((await q("SELECT title FROM public.music_sections WHERE id=$1", [mixes.id]))[0].title, "Mixtapes");
ok("owner renames and reorders a section");

await assert.rejects(q("INSERT INTO public.music_section_items(section_id,user_id,item_key,position) VALUES($1,$2,'release:x/y',0)", [mixes.id, A]).then(() =>
  q("INSERT INTO public.music_section_items(section_id,user_id,item_key,position) VALUES($1,$2,'release:x/y',0)", [albums.id, A])), /music_section_items_one_section/);
ok("an item sits in one section only");
await assert.rejects(q("INSERT INTO public.music_section_items(section_id,user_id,item_key,exclusive_track_id) VALUES($1,$2,$3,$4)", [albums.id, A, `track:${pub}x`, pub]), /key_shape/);
await assert.rejects(q("INSERT INTO public.music_section_items(section_id,user_id,item_key) VALUES($1,$2,'track:whatever')", [albums.id, A]), /key_shape/);
ok("track keys must name their own track row");
await assert.rejects(q("INSERT INTO public.music_section_items(section_id,user_id,item_key,exclusive_track_id) VALUES($1,$2,$3,$4)", [albums.id, A, `track:${bTrack}`, bTrack]), /another artist/);
ok("owner cannot place another artist's track");
await assert.rejects(q("INSERT INTO public.music_sections(user_id,title) VALUES($1,'   ')", [A]), /check/);
await assert.rejects(q("INSERT INTO public.music_sections(user_id,title,cover_url) VALUES($1,'X','javascript:alert(1)')", [A]), /check/);
ok("blank titles and non-https covers are refused");

await as("authenticated", B);
await assert.rejects(q("INSERT INTO public.music_sections(user_id,title) VALUES($1,'Hijack')", [A]), /row-level security/);
ok("another user cannot create a section for the artist");
assert.equal((await q("UPDATE public.music_sections SET title='x' WHERE user_id=$1 RETURNING id", [A])).length, 0);
assert.equal((await q("DELETE FROM public.music_sections WHERE user_id=$1 RETURNING id", [A])).length, 0);
assert.equal((await q("DELETE FROM public.music_section_items WHERE user_id=$1 RETURNING id", [A])).length, 0);
ok("another user cannot rename, delete or unplace the artist's music");
const [bSection] = await q("INSERT INTO public.music_sections(user_id,title) VALUES($1,'Mine') RETURNING id", [B]);
await assert.rejects(q("INSERT INTO public.music_section_items(section_id,user_id,item_key) VALUES($1,$2,'release:a/b')", [albums.id, B]), /another artist/);
await assert.rejects(q("INSERT INTO public.music_section_items(section_id,user_id,item_key,exclusive_track_id) VALUES($1,$2,$3,$4)", [bSection.id, B, `track:${pub}`, pub]), /another artist/);
ok("another user cannot put items into the artist's section or claim the artist's track");
await assert.rejects(q("UPDATE public.music_section_items SET section_id=$1 WHERE user_id=$2", [bSection.id, B]).then(async () => {
  await as("authenticated", A);
  await q("UPDATE public.music_section_items SET section_id=$1 WHERE item_key='release:x/y'", [bSection.id]);
}), /another artist/);
ok("owner cannot move an item into someone else's section");

await as("anon");
const anonSections = await q("SELECT title FROM public.music_sections WHERE user_id=$1 ORDER BY position", [A]);
assert.deepEqual(anonSections.map((r) => r.title), ["Albums", "Mixtapes"]);
const anonItems = await q("SELECT item_key FROM public.music_section_items WHERE user_id=$1 ORDER BY item_key", [A]);
assert.deepEqual(anonItems.map((r) => r.item_key).sort(), ["release:music.apple.com/us/album/x/1", "release:x/y", `track:${pub}`].sort());
ok("visitors read sections and placements, but not a draft track's placement");
await assert.rejects(q("INSERT INTO public.music_sections(user_id,title) VALUES($1,'x')", [A]), /permission denied/);
ok("signed-out visitors cannot write");

await as("authenticated", A);
assert.equal((await q("SELECT 1 FROM public.music_section_items WHERE user_id=$1", [A])).length, 4);
ok("owner still sees the draft placement");
await q("DELETE FROM public.exclusive_tracks WHERE id=$1", [pub]);
assert.equal((await q("SELECT 1 FROM public.music_section_items WHERE exclusive_track_id=$1", [pub])).length, 0);
ok("deleting a track removes its placement");
await q("DELETE FROM public.music_sections WHERE id=$1", [albums.id]);
assert.equal((await q("SELECT 1 FROM public.music_section_items WHERE section_id=$1", [albums.id])).length, 0);
ok("deleting a section removes its placements, not the music");
assert.equal((await q("SELECT 1 FROM public.exclusive_tracks WHERE id=$1", [draft])).length, 1);

await db.exec("RESET ROLE");
await db.exec(await readFile("supabase/rollbacks/20261115100000_music_catalog.down.sql", "utf8"));
assert.equal((await q("SELECT to_regclass('public.music_sections') r"))[0].r, null);
assert.equal((await q("SELECT count(*)::int n FROM public.exclusive_tracks"))[0].n, 2);
ok("rollback drops only the catalog tables");
console.log(`music catalog db: ${checks} checks passed`);
