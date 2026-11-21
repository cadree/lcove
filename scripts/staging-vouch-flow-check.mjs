import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const f=JSON.parse(readFileSync(process.env.STAGING_FIXTURES_FILE || '/tmp/ether-vouch-staging-fixtures.json','utf8'));
const ref='vjdrihmriufkameqngfg', origin='http://127.0.0.1:8137';
const browser=await chromium.launch({channel:'chrome'});
const errors=[];console.log('Browser started');
async function pageFor(kind){const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'dark'});if(kind)await c.addInitScript(({session,ref})=>{if(!sessionStorage.getItem('fixture-seeded')){localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(session));sessionStorage.setItem('fixture-seeded','1');}},{session:f.sessions[kind],ref});const p=await c.newPage();p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/aykopqinnnssxdhxqruo.supabase.co/**',r=>{errors.push('production request');return r.abort();});return p;}
try{
 const applicant=f.sessions.applicant.user.id;
 const headers={apikey:f.anon,Authorization:`Bearer ${f.sessions.applicant.access_token}`,'Content-Type':'application/json'};
 let response=await fetch(`https://${ref}.supabase.co/rest/v1/profiles?user_id=eq.${applicant}`,{method:'PATCH',headers,body:JSON.stringify({onboarding_completed:true})});assert.ok(response.ok,await response.text());
 console.log('Applicant submitted');const p=await pageFor('applicant');await p.goto(origin+'/pending');console.log('Opened pending');await p.getByRole('heading',{name:'Ask a creative to vouch'}).waitFor();
 const input=p.getByRole('textbox',{name:'Your vouch request link'});await input.waitFor();const link=await input.inputValue();assert.ok(link.startsWith(origin+'/vouch/'));await p.screenshot({path:'/tmp/ether-pending-vouch.png',fullPage:true});
 await p.getByRole('button',{name:'Sign out',exact:true}).click();await p.waitForURL(origin+'/');await p.goto(origin+'/auth');
 await p.getByPlaceholder('Email',{exact:true}).fill(f.passwords.applicant.email);await p.locator('input[type="password"]').fill(f.passwords.applicant.password);await p.getByRole('button',{name:'Sign in',exact:true}).last().click();await p.waitForURL('**/pending');await input.waitFor();assert.equal(await input.inputValue(),link);
 console.log('PASS actual staging sign-out/sign-in returns to pending with stable vouch link and no email code');
 const m=await pageFor('member');await m.goto(link);await m.getByRole('button',{name:'Vouch for this creative'}).waitFor();await m.getByLabel('How do you know their work? (optional)').fill('Staging test: we created a film together.');await m.getByRole('button',{name:'Vouch for this creative'}).click();await m.getByRole('status').filter({hasText:'is recorded'}).waitFor();await m.reload();await m.getByRole('status').filter({hasText:'is recorded'}).waitFor();
 console.log('PASS member vouch persists and retry renders recorded state');
 const a=await pageFor('admin');await a.goto(origin+'/admin/onboarding/'+applicant);await a.getByText('Staging test: we created a film together.').waitFor();await a.getByText('Application vouches',{exact:true}).scrollIntoViewIfNeeded();await a.screenshot({path:'/tmp/ether-admin-vouch.png',fullPage:true});assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS staging admin sees member identity and vouch note at 390px');
 const landing=await pageFor();await landing.goto(origin);await landing.getByAltText('Lotus emblem').waitFor();await landing.screenshot({path:'/tmp/ether-silver-landing.png',fullPage:true});
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
