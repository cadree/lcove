import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const {session,applicantId}=JSON.parse(readFileSync(process.env.STAGING_SESSION_FILE,'utf8'));
const ref='vjdrihmriufkameqngfg';assert.equal(JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url')).iss,`https://${ref}.supabase.co/auth/v1`);
const browser=await chromium.launch({channel:'chrome'});
try {for(const width of [390,820]){
 const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
 await c.addInitScript(({session,ref})=>{localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(session));localStorage.setItem(`welcome_shown_${session.user.id}`,'true');},{session,ref});
 const p=await c.newPage();await p.route('**/aykopqinnnssxdhxqruo.supabase.co/**',r=>r.abort());
 await p.goto(`http://127.0.0.1:8131/admin/onboarding/${applicantId}`);
 await p.getByRole('link',{name:'https://instagram.com/etherbylcove'}).waitFor({timeout:30000});
 await p.getByRole('link',{name:'https://etherbylcove.com/'}).waitFor();
 await p.getByText('Application links',{exact:true}).scrollIntoViewIfNeeded();
 await p.screenshot({path:`docs/membership-review/screenshots/admin-review-${width}.png`,fullPage:true});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await c.close();console.log(`${width}px: actual staging admin can review both saved application links`);
}}finally{await browser.close();}
