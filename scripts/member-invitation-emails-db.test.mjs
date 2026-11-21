import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("pending and active creatives can email invitations, without bypassing approval or email limits", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA pgmq;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $fn$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
        SELECT current_setting('request.jwt.claim.role',true)
      $fn$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
      CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,display_name text,access_status text DEFAULT 'pending',onboarding_completed boolean DEFAULT false);
      CREATE FUNCTION public.ether_member_approved() RETURNS boolean LANGUAGE sql STABLE AS $fn$
        SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.access_status='active' AND p.onboarding_completed)
      $fn$;
      CREATE TABLE public.notifications(user_id uuid,type text,title text,body text,data jsonb);
      CREATE TABLE public.test_queue(queue text,payload jsonb);
      CREATE FUNCTION pgmq.send(q text,p jsonb) RETURNS bigint LANGUAGE plpgsql AS $fn$
        BEGIN INSERT INTO public.test_queue VALUES(q,p); RETURN 1; END
      $fn$;
    `);
    for (const migration of [
      "20261117060000_member_referrals_and_familcy_acceptance.sql",
      "20261117125000_direct_member_invitation_emails.sql",
    ]) {
      await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    }
    const pending = "00000000-0000-4000-8000-000000000811";
    const active = "00000000-0000-4000-8000-000000000812";
    const unverified = "00000000-0000-4000-8000-000000000813";
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'pending@example.com',now()),($2,'active@example.com',now()),($3,'unverified@example.com',null)", [pending,active,unverified]);
    await db.query("INSERT INTO profiles(user_id,display_name,access_status,onboarding_completed) VALUES($1,'Waiting Creative','pending',true),($2,'Active Creative','active',true),($3,'No Confirmed Email','pending',true)", [pending,active,unverified]);
    const setUser = async (id) => {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
      await db.query("SELECT set_config('request.jwt.claim.role','authenticated',false)");
    };

    await setUser(pending);
    await db.query("SELECT set_config('request.path','/rpc/get_my_member_referral_code',false)");
    await db.query("SELECT public.ether_pending_request_guard()");
    const code=(await db.query("SELECT public.get_my_member_referral_code() AS code")).rows[0].code;
    assert.match(code,/^[a-f0-9]{32}$/);
    await db.query("SELECT set_config('request.path','/rpc/send_member_referral_invite',false)");
    await db.query("SELECT public.ether_pending_request_guard()");
    const queued=await db.query("SELECT public.send_member_referral_invite('  New Creative  ',' NEW@example.com ') AS result");
    assert.deepEqual(queued.rows[0].result,{queued:true});
    const emailRow=(await db.query("SELECT recipient_name,recipient_email,introduction_kind FROM public.member_invitation_emails")).rows[0];
    assert.deepEqual(emailRow,{recipient_name:"New Creative",recipient_email:"new@example.com",introduction_kind:"referral"});
    const mail=(await db.query("SELECT queue,payload FROM public.test_queue")).rows[0];
    assert.equal(mail.queue,"transactional_emails");
    assert.equal(mail.payload.label,"ether_member_invite");
    assert.equal(mail.payload.to,"new@example.com");
    assert.match(mail.payload.text,/New Creative/);
    assert.ok(mail.payload.text.includes(`ref=${code}`));
    assert.ok(mail.payload.text.includes("Every application")===false);
    assert.equal((await db.query("SELECT count(*)::int n FROM member_referrals")).rows[0].n,0,"An invitation must not grant access or create a referral before signup.");
    await assert.rejects(db.query("SELECT public.send_member_referral_invite('New Creative','new@example.com')"),/already invited/);
    await assert.rejects(db.query("SELECT public.send_member_referral_invite('Self','pending@example.com')"),/another creative/);
    await assert.rejects(db.query("SELECT public.send_member_referral_invite('Wrong','not-an-email')"),/valid email address/);
    await db.query("SELECT set_config('request.path','/rpc/notifications',false)");
    await assert.rejects(db.query("SELECT public.ether_pending_request_guard()"),/awaiting approval/);

    // The first invitation plus nine more reach the exact 24-hour cap.
    for (let i=0;i<9;i++) {
      await db.query("SELECT public.send_member_referral_invite($1,$2)",[`Creative ${i}`,`another${i}@example.net`]);
    }
    assert.equal((await db.query("SELECT count(*)::int n FROM public.member_invitation_emails")).rows[0].n,10);
    await assert.rejects(db.query("SELECT public.send_member_referral_invite('Over limit','limit@example.net')"),/10 invitations/);
    // Replay of a token does not create a new referral until invitee signs up.
    assert.equal((await db.query("SELECT count(*)::int n FROM public.member_referrals")).rows[0].n,0);

    await setUser(active);
    const activeLink=(await db.query("SELECT public.get_my_member_referral_code() AS code")).rows[0].code;
    await db.query("SELECT public.send_member_referral_invite('Another Artist','another@example.net')");
    const activeEmail=(await db.query("SELECT payload FROM public.test_queue ORDER BY ctid DESC LIMIT 1")).rows[0].payload;
    assert.ok(activeEmail.text.includes("vouching for you"));
    assert.ok(activeEmail.text.includes(`ref=${activeLink}`));

    await setUser(unverified);
    await assert.rejects(db.query("SELECT public.send_member_referral_invite('Not Allowed','person@example.net')"),/verified email/);
    const grants=(await db.query("SELECT has_table_privilege('authenticated','public.member_invitation_emails','SELECT') AS can_read")).rows[0];
    assert.equal(grants.can_read,false,"Direct recipient list access must remain blocked");
  } finally {
    await db.close();
  }
});
