import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE profiles(user_id uuid PRIMARY KEY,display_name text,access_status text,onboarding_completed boolean,deleted_at timestamptz,is_suspended boolean);
CREATE TABLE user_roles(user_id uuid,role text);
CREATE FUNCTION has_role(id uuid,r text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=id AND role=r)$$;
CREATE FUNCTION ether_pending_request_guard() RETURNS void LANGUAGE plpgsql AS $$BEGIN IF current_setting('request.path',true)='/rpc/get_my_member_referral_code' THEN RETURN; END IF; RAISE EXCEPTION 'blocked'; END$$;`);
await db.exec(await readFile('supabase/migrations/20261117203615_membership_vouch_links.sql','utf8'));
const ids=[1,2,3,4].map(n=>`00000000-0000-4000-8000-00000000000${n}`);
for(let i=0;i<ids.length;i++){await db.query('INSERT INTO auth.users VALUES($1)',[ids[i]]);await db.query("INSERT INTO profiles VALUES($1,$2,$3,true,null,false)",[ids[i],['Applicant','Member','Admin','Pending peer'][i],i===0||i===3?'pending':'active']);}
await db.query("INSERT INTO user_roles VALUES($1,'admin')",[ids[2]]);
const as=async i=>db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);
await as(0);const token=(await db.query('SELECT get_my_membership_vouch_link() token')).rows[0].token;
assert.equal((await db.query('SELECT get_my_membership_vouch_link() token')).rows[0].token,token);
await assert.rejects(db.query('SELECT submit_membership_vouch($1,$2)',[token,'self']),/Only approved/);
await as(3);await assert.rejects(db.query('SELECT submit_membership_vouch($1,$2)',[token,'pending']),/Only approved/);
await as(null);await assert.rejects(db.query('SELECT membership_vouch_context($1)',[token]),/Sign in/);
await as(1);await db.query('SELECT submit_membership_vouch($1,$2)',[token,'We made a film together.']);await db.query('SELECT submit_membership_vouch($1,$2)',[token,'retry']);
assert.equal((await db.query('SELECT count(*) n FROM membership_vouches')).rows[0].n,1);
await assert.rejects(db.query('SELECT membership_vouches_for_review($1)',[ids[0]]),/Admins only/);
await as(2);const review=(await db.query('SELECT membership_vouches_for_review($1) r',[ids[0]])).rows[0].r;
assert.equal(review[0].member_id,ids[1]);assert.equal(review[0].note,'We made a film together.');
await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[ids[0]]);
await as(1);await assert.rejects(db.query('SELECT submit_membership_vouch($1,$2)',[token,'late']),/no longer/);
await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT * FROM membership_vouches'),/permission denied/);
console.log('PASS: stable links, signed-in approved endorsers, no self/pending/anonymous vouch, duplicate retry, admin-only attribution, closed application, private tables');
}finally{await db.close();}
