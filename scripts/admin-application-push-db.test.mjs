import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("only admins can enable new-member pushes; first application enqueues once", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
      $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.role', true),'')
      $$;
      CREATE TABLE public.user_roles(user_id uuid, role text);
      CREATE FUNCTION public.has_role(id uuid, wanted text) RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=id AND role=wanted)
      $$;
      CREATE TABLE public.profiles(
        user_id uuid PRIMARY KEY,
        onboarding_completed boolean NOT NULL DEFAULT false,
        access_status text NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE public.notification_preferences(
        user_id uuid PRIMARY KEY,
        push_enabled boolean NOT NULL DEFAULT true
      );
      CREATE SCHEMA pgmq;
      CREATE TABLE public.test_push_queue(queue_name text, message jsonb);
      CREATE FUNCTION pgmq.create(name text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE FUNCTION pgmq.send(name text, payload jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO public.test_push_queue VALUES (name,payload);
        RETURN 1;
      END $$;
    `);
    await db.exec(await readFile("supabase/migrations/20261116104000_admin_application_push_preferences.sql", "utf8"));
    const admin = "00000000-0000-4000-8000-000000000201";
    const other = "00000000-0000-4000-8000-000000000202";
    const applicant = "00000000-0000-4000-8000-000000000203";
    await db.query("INSERT INTO public.user_roles VALUES($1,'admin'),($2,'user')", [admin, other]);
    await db.query("INSERT INTO public.notification_preferences(user_id) VALUES($1),($2)", [admin,other]);
    const prefs = await db.query("SELECT new_member_applications_push_enabled FROM public.notification_preferences");
    assert.ok(prefs.rows.every(row=>row.new_member_applications_push_enabled===false));

    await db.query("SELECT set_config('request.jwt.claim.role','authenticated',false)");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [other]);
    await assert.rejects(db.query(
      "UPDATE public.notification_preferences SET new_member_applications_push_enabled=true WHERE user_id=$1",
      [other]), /Only administrators/);

    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin]);
    await db.query("UPDATE public.notification_preferences SET new_member_applications_push_enabled=true WHERE user_id=$1", [admin]);
    let rows=await db.query("SELECT user_id,new_member_applications_push_enabled FROM public.notification_preferences");
    assert.equal(rows.rows.find(r=>r.user_id===admin).new_member_applications_push_enabled,true);
    assert.equal(rows.rows.find(r=>r.user_id===other).new_member_applications_push_enabled,false);

    await db.query("INSERT INTO public.profiles(user_id) VALUES($1)", [applicant]);
    await db.query("UPDATE public.profiles SET onboarding_completed=true WHERE user_id=$1", [applicant]);
    await db.query("UPDATE public.profiles SET access_status='active' WHERE user_id=$1", [applicant]);
    const queued=await db.query("SELECT queue_name,message->>'applicant_id' AS applicant_id FROM public.test_push_queue");
    assert.deepEqual(queued.rows,[{queue_name:"member_application_pushes",applicant_id:applicant}]);
  } finally {
    await db.close();
  }
});
