// Music page prefs migration on a throwaway Postgres (PGlite): public read,
// owner-only writes, look limited to ether/neon, idempotent apply.
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
 CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
`);
const migration = await readFile("supabase/migrations/20261123120000_music_page_prefs.sql", "utf8");
await db.exec(migration);
await db.exec(migration);

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
for (const id of [A, B]) await db.query("INSERT INTO auth.users VALUES($1)", [id]);
let checks = 0;
const ok = (label) => console.log(`ok ${++checks} - ${label}`);
async function as(role, id = "") {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${id}', false); SET ROLE ${role};`);
}
const fails = async (sql, params) => {
  try { await db.query(sql, params); } catch { return true; }
  return false;
};

await as("authenticated", A);
await db.query("INSERT INTO public.music_page_prefs(user_id, look, featured_key, loose_order) VALUES($1,'neon','track:x',ARRAY['release:a','track:x'])", [A]);
ok("an owner saves their look and order");
assert.equal(await fails("INSERT INTO public.music_page_prefs(user_id) VALUES($1)", [B]), true);
ok("nobody writes another member's prefs");
assert.equal(await fails("UPDATE public.music_page_prefs SET look='glitter' WHERE user_id=$1", [A]), true);
ok("look is ether or neon only");
await as("authenticated", B);
const upd = await db.query("UPDATE public.music_page_prefs SET look='ether' WHERE user_id=$1", [A]);
assert.equal(upd.affectedRows ?? 0, 0);
ok("another member's update changes nothing");
await as("anon");
const seen = await db.query("SELECT look, loose_order FROM public.music_page_prefs WHERE user_id=$1", [A]);
assert.equal(seen.rows[0].look, "neon");
assert.deepEqual(seen.rows[0].loose_order, ["release:a", "track:x"]);
ok("visitors see the owner's look and order");
assert.equal(await fails("INSERT INTO public.music_page_prefs(user_id) VALUES($1)", [A]), true);
ok("signed-out visitors cannot write");
console.log(`# ${checks} checks passed`);
