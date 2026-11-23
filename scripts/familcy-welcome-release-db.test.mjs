import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20261117060000_member_referrals_and_familcy_acceptance.sql",
  "20261117070000_familcy_welcome_card_handoff.sql",
];

async function setup() {
  const db = new PGlite();
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth; CREATE SCHEMA pgmq;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
     SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
   $fn$;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
   CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,display_name text,username text,passion_title text,access_status text DEFAULT 'pending',onboarding_completed boolean DEFAULT false);
   CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,type text,title text,body text,data jsonb);
   CREATE FUNCTION pgmq.send(q text,p jsonb) RETURNS bigint LANGUAGE plpgsql AS $fn$ BEGIN RETURN 1; END $fn$;
  `);
  for (const name of migrations) await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  return db;
}

const accept = async (db, id, username) => {
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())", [id, `${username}@example.com`]);
  await db.query("INSERT INTO profiles(user_id,display_name,username,passion_title,access_status,onboarding_completed) VALUES($1,'A',$2,'Director','pending',true)", [id, username]);
  await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1", [id]);
};
const as = (db, id) => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
const status = async (db) => (await db.query("SELECT public.get_my_familcy_welcome_status() AS s")).rows[0].s;
const fix = () => readFile("supabase/migrations/20261123030000_familcy_welcome_finishes_on_card.sql", "utf8");

test("a member stuck with a card but no finished welcome is released by the migration", async () => {
  const db = await setup();
  try {
    const stuck = "00000000-0000-4000-8000-000000000801";
    const fresh = "00000000-0000-4000-8000-000000000802";
    await accept(db, stuck, "stuck_one");
    await accept(db, fresh, "fresh_one");
    await as(db, stuck);
    await db.query("SELECT public.register_my_ether_card()");
    assert.deepEqual(await status(db), { needs_setup: true, card_registered: true });

    await db.exec(await fix());
    assert.deepEqual(await status(db), { needs_setup: false, card_registered: true });
    // Without a card, the welcome is still owed.
    await as(db, fresh);
    assert.deepEqual(await status(db), { needs_setup: true, card_registered: false });
  } finally {
    await db.close();
  }
});

test("after the migration, registering the card finishes the welcome in one step", async () => {
  const db = await setup();
  try {
    await db.exec(await fix());
    const member = "00000000-0000-4000-8000-000000000803";
    await accept(db, member, "new_member");
    await as(db, member);
    assert.deepEqual(await status(db), { needs_setup: true, card_registered: false });
    await db.query("SELECT public.register_my_ether_card()");
    assert.deepEqual(await status(db), { needs_setup: false, card_registered: true });
    // Re-saving the card and the old Continue tap stay harmless.
    await db.query("SELECT public.register_my_ether_card()");
    await db.query("SELECT public.complete_my_familcy_welcome()");
    assert.deepEqual(await status(db), { needs_setup: false, card_registered: true });

    const noProfile = "00000000-0000-4000-8000-000000000804";
    await as(db, noProfile);
    await assert.rejects(db.query("SELECT public.register_my_ether_card()"), /username and a creative passion/);
  } finally {
    await db.close();
  }
});
