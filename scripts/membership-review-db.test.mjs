import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('membership review accepts either public link, checks website-only email, notifies admins once',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth; CREATE SCHEMA pgmq;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
   CREATE TABLE public.user_roles(user_id uuid,role text);
   CREATE TABLE public.notifications(user_id uuid,type text,title text,body text,data jsonb);
   CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,display_name text,city text,city_display text,access_status text DEFAULT 'pending',onboarding_completed boolean DEFAULT false,social_links jsonb DEFAULT '{}');
   CREATE TABLE public.test_queue(queue text,payload jsonb);
   CREATE FUNCTION pgmq.send(q text,p jsonb) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_queue VALUES(q,p); RETURN 1; END $$;
   INSERT INTO auth.users VALUES
     ('00000000-0000-4000-8000-000000000001','etherbylcove@gmail.com',now()),
     ('00000000-0000-4000-8000-000000000002','reviewer@example.com',now()),
     ('00000000-0000-4000-8000-000000000003','member@example.com',now()),
     ('00000000-0000-4000-8000-000000000004','portfolio@example.com',now()),
     ('00000000-0000-4000-8000-000000000005','unverified@example.com',null);
   INSERT INTO user_roles VALUES
     ('00000000-0000-4000-8000-000000000001','admin'),
     ('00000000-0000-4000-8000-000000000002','admin');
  `);
  for (const migration of [
   '20261116103000_onboarding_review_links_email.sql',
   '20261117050833_membership_review_alerts.sql',
   '20261117052021_protect_pending_review_links.sql',
   '20261117054500_one_link_verified_contact.sql',
  ]) await db.exec(await readFile(`supabase/migrations/${migration}`,'utf8'));

  const id='00000000-0000-4000-8000-000000000003';
  await db.query('INSERT INTO profiles(user_id,display_name) VALUES($1,$2)',[id,'Test applicant']);
  const submit=links=>db.query('UPDATE profiles SET onboarding_completed=true,social_links=$2::jsonb WHERE user_id=$1',[id,JSON.stringify(links)]);
  for (const links of [
   {}, {social_profile:'javascript:alert(1)'}, {website:'https://127.0.0.1'},
   {social_profile:'https://instagram.com/ada',website:'javascript:alert(1)'},
   {social_profile:'https://user:password@example.com'},
  ]) await assert.rejects(submit(links));
  assert.equal((await db.query('SELECT count(*)::int n FROM test_queue')).rows[0].n,0);

  // A social profile alone is enough.
  await submit({social_profile:'https://instagram.com/ada'});
  let emails=(await db.query('SELECT payload FROM test_queue')).rows.map(x=>x.payload);
  assert.equal(emails.length,2); // Central inbox and one other admin; no duplicate to central admin.
  assert.equal(new Set(emails.map(x=>x.to)).size,2);
  assert.ok(emails.every(x=>x.text.includes('Verified contact email: member@example.com')));
  assert.ok(emails.every(x=>x.text.includes('/admin/onboarding/'+id)));
  assert.equal((await db.query('SELECT count(*)::int n FROM notifications')).rows[0].n,2);
  await db.query('UPDATE profiles SET display_name=$2 WHERE user_id=$1',[id,'Updated name']);
  assert.equal((await db.query('SELECT count(*)::int n FROM test_queue')).rows[0].n,2);
  await assert.rejects(db.query("UPDATE profiles SET social_links='{}' WHERE user_id=$1",[id]),/required for review/);
  // Still pending: switching from social to a verified-contact website is allowed.
  await db.query("UPDATE profiles SET social_links=$2::jsonb WHERE user_id=$1",[id,JSON.stringify({website:'https://portfolio.example.com'})]);
  assert.equal((await db.query('SELECT count(*)::int n FROM test_queue')).rows[0].n,2);
  await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[id]);
  await db.query("UPDATE profiles SET social_links='{}' WHERE user_id=$1",[id]);

  // Website-only applicant is accepted when their signup email was confirmed.
  const site='00000000-0000-4000-8000-000000000004';
  await db.query("INSERT INTO profiles(user_id,display_name) VALUES($1,'Portfolio applicant')",[site]);
  await db.query("UPDATE profiles SET onboarding_completed=true,social_links=$2::jsonb WHERE user_id=$1",
    [site,JSON.stringify({website:'https://portfolio.example.com'})]);
  emails=(await db.query('SELECT payload FROM test_queue')).rows.map(x=>x.payload);
  assert.equal(emails.length,4);
  assert.equal((await db.query('SELECT count(*)::int n FROM notifications')).rows[0].n,4);
  assert.ok(emails.filter(x=>x.text.includes('portfolio@example.com')).length===2);

  // Website-only without a verified account email is NOT accepted.
  const unverified='00000000-0000-4000-8000-000000000005';
  await db.query("INSERT INTO profiles(user_id,display_name) VALUES($1,'Unverified applicant')",[unverified]);
  await assert.rejects(db.query("UPDATE profiles SET onboarding_completed=true,social_links=$2::jsonb WHERE user_id=$1",
    [unverified,JSON.stringify({website:'https://portfolio.example.com'})]),/Verify your account email/);
  assert.equal((await db.query('SELECT count(*)::int n FROM test_queue')).rows[0].n,4);
 } finally {await db.close();}
});
