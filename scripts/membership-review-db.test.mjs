import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('membership review validates both URLs and atomically notifies each admin and central inbox once',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA pgmq;
 CREATE TABLE auth.users(id uuid primary key,email text);
 CREATE TABLE public.user_roles(user_id uuid,role text);
 CREATE TABLE public.notifications(user_id uuid,type text,title text,body text,data jsonb);
 CREATE TABLE public.profiles(user_id uuid primary key,display_name text,city text,city_display text,access_status text default 'pending',onboarding_completed boolean default false,social_links jsonb default '{}');
 CREATE TABLE public.test_queue(queue text,payload jsonb);
 CREATE FUNCTION pgmq.send(q text,p jsonb) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_queue VALUES(q,p); RETURN 1; END $$;
 INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001','etherbylcove@gmail.com'),('00000000-0000-4000-8000-000000000002','reviewer@example.com'),('00000000-0000-4000-8000-000000000003','member@example.com');
 INSERT INTO user_roles VALUES('00000000-0000-4000-8000-000000000001','admin'),('00000000-0000-4000-8000-000000000002','admin');`);
 await db.exec(await readFile('supabase/migrations/20261116103000_onboarding_review_links_email.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261117050833_membership_review_alerts.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261117052021_protect_pending_review_links.sql','utf8'));
 const id='00000000-0000-4000-8000-000000000003';
 await db.query('INSERT INTO profiles(user_id,display_name) VALUES($1,$2)',[id,'Test applicant']);
 const submit=links=>db.query('UPDATE profiles SET onboarding_completed=true,social_links=$2::jsonb WHERE user_id=$1',[id,JSON.stringify(links)]);
 for(const links of [{},{social_profile:'https://instagram.com/ada'},{website:'https://portfolio.example.com'}, {social_profile:'https://instagram.com/ada',website:'javascript:alert(1)'},{social_profile:'https://user:password@example.com',website:'https://example.com'},{social_profile:'https://127.0.0.1',website:'https://example.com'}]) await assert.rejects(submit(links));
 assert.equal((await db.query('SELECT count(*)::int n FROM test_queue')).rows[0].n,0);
 await submit({social_profile:'https://instagram.com/ada',website:'https://portfolio.example.com'});
 const messages=(await db.query('SELECT payload FROM test_queue')).rows;
 assert.equal(messages.length,2); assert.equal(new Set(messages.map(x=>x.payload.to)).size,2);
 assert.ok(messages.every(x=>x.payload.text.includes('/admin/onboarding/'+id)));
 assert.equal((await db.query('SELECT count(*)::int n FROM notifications')).rows[0].n,2);
 await db.query('UPDATE profiles SET onboarding_completed=true,display_name=$2 WHERE user_id=$1',[id,'Updated name']);
 assert.equal((await db.query('SELECT count(*)::int n FROM test_queue')).rows[0].n,2);
 await assert.rejects(db.query("UPDATE profiles SET social_links='{}' WHERE user_id=$1",[id]),/required for review/);
 // Approved members retain ordinary profile editing.
 await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[id]);
 await db.query("UPDATE profiles SET social_links='{}' WHERE user_id=$1",[id]);
 }finally{await db.close();}
});
