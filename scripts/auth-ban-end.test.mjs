import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

// The newest migration that defines admin_set_auth_ban is the one in force.
const dir = "supabase/migrations";
const latest = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(`${dir}/${name}`, "utf8") }))
  .filter(({ sql }) => /FUNCTION public\.admin_set_auth_ban\(/.test(sql))
  .at(-1);

const body = latest.sql.slice(latest.sql.indexOf("FUNCTION public.admin_set_auth_ban("));
const fn = body.slice(0, body.indexOf("$fn$;"));

test("a removal or ban blocks login until a fixed date Supabase Auth can read", () => {
  assert.ok(latest.name >= "20261121180000", `admin_set_auth_ban was last defined in ${latest.name}`);
  assert.equal(/infinity/i.test(fn.replace(/--.*$/gm, "")), false, "banned_until must not be 'infinity'");
  assert.match(fn, /'2126-01-01 00:00:00\+00'::timestamptz/);
});

test("restore and unban still clear the ban", () => {
  assert.match(fn, /SET banned_until = NULL WHERE id = \$1/);
});

test("stuck 'infinity' bans are moved to the same fixed date", () => {
  assert.match(latest.sql, /WHERE banned_until = ''infinity''::timestamptz'\s*\n\s*USING '2126-01-01 00:00:00\+00'::timestamptz/);
});
