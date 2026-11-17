import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("member invitations never auto-approve and acceptance notices send once", async () => {
 const db = new PGlite();
 try {
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth; CREATE SCHEMA pgmq;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
     SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
   $fn$;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
   CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,display_name text,access_status text DEFAULT 'pending',onboarding_completed boolean DEFAULT false);
   CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,type text,title text,body text,data jsonb);
   CREATE TABLE public.test_queue(queue text,payload jsonb);
   CREATE FUNCTION pgmq.send(q text,p jsonb) RETURNS bigint LANGUAGE plpgsql AS $fn$
    BEGIN INSERT INTO public.test_queue VALUES(q,p); RETURN 1; END
   $fn$;
  `);
  await db.exec(await readFile("supabase/migrations/20261117060000_member_referrals_and_familcy_acceptance.sql", "utf8"));
  const sponsor="00000000-0000-4000-8000-000000000701";
  const applicant="00000000-0000-4000-8000-000000000702";
  const waiting="00000000-0000-4000-8000-000000000703";
  const invited="00000000-0000-4000-8000-000000000704";
  const outsider="00000000-0000-4000-8000-000000000705";
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'sponsor@example.com',now()),($2,'waiting@example.com',now())",[sponsor,waiting]);
  await db.query("INSERT INTO profiles(user_id,display_name,access_status,onboarding_completed) VALUES($1,'The Sponsor','active',true),($2,'Waiting Sponsor','pending',true)",[sponsor,waiting]);
  const setUser=id=>db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
  await setUser(sponsor);
  const code=(await db.query("SELECT public.get_my_member_referral_code() AS code")).rows[0].code;
  assert.match(code,/^[a-f0-9]{32}$/);
  assert.equal((await db.query("SELECT public.get_my_member_referral_code() AS code")).rows[0].code,code);
  assert.deepEqual((await db.query("SELECT public.preview_member_referral($1) AS preview",[code])).rows[0].preview,{name:"The Sponsor",kind:"vouch"});
  assert.equal((await db.query("SELECT public.preview_member_referral('invalid') AS preview")).rows[0].preview,null);
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'new@example.com',now(),$2::jsonb)",[applicant,JSON.stringify({ether_referral_code:code})]);
  assert.deepEqual((await db.query("SELECT sponsor_user_id,introduction_kind FROM member_referrals WHERE applicant_user_id=$1",[applicant])).rows[0],{sponsor_user_id:sponsor,introduction_kind:"vouch"});
  await db.query("INSERT INTO profiles(user_id,display_name,access_status,onboarding_completed) VALUES($1,'New Creative','pending',true)",[applicant]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n,0);
  await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[applicant]);
  let notifications=(await db.query("SELECT user_id,type FROM notifications")).rows;
  assert.equal(notifications.length,2);
  assert.ok(notifications.some(n=>n.user_id===applicant&&n.type==="membership_accepted"));
  assert.ok(notifications.some(n=>n.user_id===sponsor&&n.type==="referral_accepted"));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM test_queue")).rows[0].n,2);
  await db.query("UPDATE profiles SET access_status='pending' WHERE user_id=$1",[applicant]);
  await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[applicant]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n,2);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM test_queue")).rows[0].n,2);
  await setUser(waiting);
  const waitingCode=(await db.query("SELECT public.get_my_member_referral_code() AS code")).rows[0].code;
  assert.deepEqual((await db.query("SELECT public.preview_member_referral($1) AS preview",[waitingCode])).rows[0].preview,{name:"Waiting Sponsor",kind:"referral"});
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'invited@example.com',now(),$2::jsonb)",[invited,JSON.stringify({ether_referral_code:waitingCode})]);
  assert.equal((await db.query("SELECT introduction_kind FROM member_referrals WHERE applicant_user_id=$1",[invited])).rows[0].introduction_kind,"referral");
  await db.query("INSERT INTO profiles(user_id,display_name,access_status,onboarding_completed) VALUES($1,'Invited Creative','pending',true)",[invited]);
  await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[invited]);
  assert.ok((await db.query("SELECT 1 FROM notifications WHERE user_id=$1 AND type='referral_accepted'",[waiting])).rows.length>0);
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'outsider@example.com',now(),$2::jsonb)",[outsider,JSON.stringify({ether_referral_code:"invalid"})]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM member_referrals WHERE applicant_user_id=$1",[outsider])).rows[0].n,0);
  await setUser(outsider);
  await assert.rejects(db.query("SELECT public.get_my_member_referral_code()"),/Only active members and applicants/);
 } finally { await db.close(); }
});
