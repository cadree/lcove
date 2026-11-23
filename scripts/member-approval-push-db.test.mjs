import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const pending = "00000000-0000-4000-8000-000000000401";
const other = "00000000-0000-4000-8000-000000000402";

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true),'') $$;
    CREATE TABLE public.profiles(user_id uuid PRIMARY KEY, access_status text NOT NULL, onboarding_completed boolean NOT NULL);
    CREATE FUNCTION public.ether_member_approved() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
      SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.access_status='active' AND p.onboarding_completed) $$;
    CREATE TABLE public.push_subscriptions(user_id uuid NOT NULL, endpoint text NOT NULL, platform text, UNIQUE(user_id,endpoint));
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
    CREATE POLICY own_insert ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY own_select ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY ether_pending_access ON public.push_subscriptions AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.ether_member_approved())) WITH CHECK ((SELECT public.ether_member_approved()));
    CREATE FUNCTION public.ether_pending_request_guard() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
    DECLARE path text:=current_setting('request.path',true);
    BEGIN
      IF auth.role()='service_role' OR auth.uid() IS NULL OR public.ether_member_approved() THEN RETURN; END IF;
      IF path IN ('/profiles','/rpc/get_my_membership_vouch_link','/rpc/get_my_member_referral_code') THEN RETURN; END IF;
      RAISE EXCEPTION 'Your application is awaiting approval.' USING ERRCODE='42501';
    END; $fn$;
    GRANT EXECUTE ON FUNCTION public.ether_pending_request_guard() TO authenticated;
    CREATE TABLE public.member_acceptance_events(applicant_user_id uuid PRIMARY KEY);
    CREATE SCHEMA pgmq;
    CREATE TABLE public.test_queues(name text PRIMARY KEY);
    CREATE TABLE public.test_push_queue(queue_name text, message jsonb);
    CREATE FUNCTION pgmq.create(name text) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.test_queues VALUES(name) ON CONFLICT DO NOTHING $$;
    CREATE FUNCTION pgmq.drop_queue(name text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM public.test_queues WHERE test_queues.name=$1 RETURNING true $$;
    CREATE FUNCTION pgmq.send(name text, payload jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO public.test_push_queue VALUES(name,payload); RETURN 1; END $$;
    INSERT INTO public.profiles VALUES ('${pending}','pending',true), ('${other}','active',true);
  `);
  return db;
}

async function as(db, userId, path, fn) {
  await db.query("SELECT set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub',$1,false), set_config('request.path',$2,false)", [userId, path]);
  await db.exec("SET ROLE authenticated");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}

const saveToken = (db, owner) => db.query("INSERT INTO public.push_subscriptions(user_id,endpoint,platform) VALUES($1,$2,'apns')", [owner, `apns:${owner.slice(-4)}`]);
const guard = (db) => db.query("SELECT public.ether_pending_request_guard()");

test("pending applicant can save only their own device token; approval queues one push; rollback restores", async () => {
  const db = await setup();
  try {
    // Before: the exact failure seen in production (0 of 8 approved members had a token at approval).
    await assert.rejects(as(db, pending, "/push_subscriptions", () => guard(db)), /awaiting approval/);
    await assert.rejects(as(db, pending, "/push_subscriptions", () => saveToken(db, pending)), /row-level security/);

    await db.exec(await readFile("supabase/migrations/20261123010000_member_approval_push.sql", "utf8"));

    await as(db, pending, "/push_subscriptions", () => guard(db));
    await as(db, pending, "/push_subscriptions", () => saveToken(db, pending));
    await assert.rejects(as(db, pending, "/push_subscriptions", () => saveToken(db, other)), /row-level security/);
    // Other member data stays closed to a pending applicant.
    await assert.rejects(as(db, pending, "/posts", () => guard(db)), /awaiting approval/);
    const mine = await as(db, pending, "/push_subscriptions", () => db.query("SELECT user_id FROM public.push_subscriptions"));
    assert.deepEqual(mine.rows.map((r) => r.user_id), [pending]);

    // Re-running is a no-op for the guard (no duplicate path entries).
    await db.exec(await readFile("supabase/migrations/20261123010000_member_approval_push.sql", "utf8"));
    const def = (await db.query("SELECT pg_get_functiondef('public.ether_pending_request_guard()'::regprocedure) d")).rows[0].d;
    assert.equal(def.split("'/push_subscriptions'").length - 1, 1);

    await db.query("INSERT INTO public.member_acceptance_events VALUES($1)", [pending]);
    await db.query("INSERT INTO public.member_acceptance_events VALUES($1) ON CONFLICT DO NOTHING", [pending]);
    const queued = await db.query("SELECT queue_name, message->>'applicant_id' AS applicant_id FROM public.test_push_queue");
    assert.deepEqual(queued.rows, [{ queue_name: "member_approval_pushes", applicant_id: pending }]);
    const queues = await db.query("SELECT name FROM public.test_queues ORDER BY 1");
    assert.deepEqual(queues.rows.map((r) => r.name), ["member_approval_pushes", "member_approval_pushes_dlq"]);

    await db.exec(await readFile("supabase/rollbacks/20261123010000_member_approval_push.down.sql", "utf8"));
    await assert.rejects(as(db, pending, "/push_subscriptions", () => guard(db)), /awaiting approval/);
    await db.query("DELETE FROM public.push_subscriptions");
    await assert.rejects(as(db, pending, "/push_subscriptions", () => saveToken(db, pending)), /row-level security/);
    await as(db, pending, "/rpc/get_my_member_referral_code", () => guard(db));
    await db.query("INSERT INTO public.member_acceptance_events VALUES($1)", [other]);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.test_push_queue")).rows[0].n, 1);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.test_queues")).rows[0].n, 0);
  } finally {
    await db.close();
  }
});
