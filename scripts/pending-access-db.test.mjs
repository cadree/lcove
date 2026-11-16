import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bridgeDb,addUser,as} from './creative-bridge-fixture.mjs';
const {db}=await bridgeDb();
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pending=uid(1),active=uid(2),admin=uid(3),reviewer=uid(4);
for(const [id,name,status] of [[pending,'Applicant','pending'],[active,'Member','active'],[admin,'Admin','pending'],[reviewer,'Apple reviewer','active']]) await addUser(db,id,name,'charlotte|nc',{access_status:status});
await db.exec(`CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
INSERT INTO user_roles(user_id,role) VALUES('${admin}','admin');
INSERT INTO posts(user_id,content) VALUES('${active}','Member work');`);
await db.exec(`CREATE SCHEMA storage; CREATE TABLE storage.objects(id int, owner_id text);
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_storage ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);
INSERT INTO storage.objects VALUES(1,'${pending}'),(2,'${active}');`);
await db.exec(await readFile('supabase/migrations/20261116091000_pending_member_access.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261116092000_pending_storage_access.sql','utf8'));
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const count=async(table)=>(await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
const request=async(path)=>{await db.query("SELECT set_config('request.path',$1,false)",[path]);return db.query('SELECT public.ether_pending_request_guard()');};
await as(db,'authenticated',pending);
eq(await count('posts'),0);
eq(await count('storage.objects'),1);
await db.query('INSERT INTO storage.objects VALUES(3,$1)',[pending]);checks++;
await assert.rejects(db.query('INSERT INTO storage.objects VALUES(4,$1)',[active]),/row-level security/);checks++;
eq(await count('profiles_public'),1);
eq((await db.query('SELECT user_id FROM profiles_public')).rows[0].user_id,pending);
await db.query("UPDATE profiles SET city='Atlanta' WHERE user_id=$1",[pending]);
eq((await db.query('SELECT city FROM profiles WHERE user_id=$1',[pending])).rows[0].city,'Atlanta');
for(const path of ['/rpc/discovery_globe','/rpc/creative_swipe','/rpc/profile_credits','/posts']){
 await assert.rejects(request(path),/awaiting approval/);checks++;
}
for(const path of ['/profiles','/profiles_public','/passions','/user_passions','/rpc/claim_waitlist_invite']) {await request(path);checks++;}
await assert.rejects(db.query('INSERT INTO posts(user_id,content) VALUES($1,$2)',[pending,'Blocked']),/row-level security/);checks++;
for(const person of [active,admin,reviewer]){
 await as(db,'authenticated',person);await request('/rpc/discovery_globe');checks++;
 eq(await count('posts'),1);
 if(person!==admin) eq(await count('profiles_public'),2);
}
await as(db,'postgres');
await db.query("UPDATE profiles SET access_status='active' WHERE user_id=$1",[pending]);
await as(db,'authenticated',pending);await request('/posts');eq(await count('posts'),1);
await as(db,'postgres');await db.query('UPDATE profiles SET is_suspended=true WHERE user_id=$1',[pending]);
await as(db,'authenticated',pending);await assert.rejects(request('/posts'),/awaiting approval/);checks++;
await as(db,'postgres');
await db.exec(await readFile('supabase/rollbacks/20261116092000_pending_storage_access.down.sql','utf8'));
await db.exec(await readFile('supabase/rollbacks/20261116091000_pending_member_access.down.sql','utf8'));
await as(db,'authenticated',pending);eq(await count('posts'),1);
await db.close();
console.log(`${checks} pending-access checks passed (applicant, active member, admin, reviewer, suspension, rollback)`);
