// Uses a temporary, confirmed synthetic staging account supplied by the local
// operator. Never creates accounts or sends email. No production project.
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const session=JSON.parse(readFileSync(process.env.STAGING_SESSION_FILE,'utf8'));
const ref='vjdrihmriufkameqngfg';
const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
assert.equal(claims.iss,`https://${ref}.supabase.co/auth/v1`);
const browser=await chromium.launch({channel:'chrome'});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'dark'});
 await context.addInitScript(({session,ref})=>{
  localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(session));
  localStorage.setItem(`ether-onboarding-draft:${session.user.id}`,JSON.stringify({version:2,step:3,data:{displayName:'Staging Creative',memberOf:'',passions:['Photography'],passionSeriousness:5,city:'Atlanta',cityDisplay:'Atlanta, GA',cityKey:'atlanta|ga',skills:[],roles:[],questionnaireResponses:{}}}));
 },{session,ref});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/aykopqinnnssxdhxqruo.supabase.co/**',route=>{errors.push('Unexpected production request');return route.abort();});
 let failSave=true;
 await page.route(`https://${ref}.supabase.co/rest/v1/profiles?**`, async route=>{
  if(route.request().method()==='PATCH' && failSave){failSave=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic save failure'})});}
  return route.continue();
 });
 await page.goto('http://127.0.0.1:8131/onboarding');
 await page.getByRole('button',{name:"I'm in",exact:true}).click({timeout:30000});
 await page.getByText('Error saving data',{exact:true}).waitFor();
 assert.ok(page.url().endsWith('/onboarding'));
 assert.ok(await page.evaluate(id=>!!localStorage.getItem(`ether-onboarding-draft:${id}`),session.user.id));
 console.log('Failed profile save keeps the applicant on the oath and preserves the draft');
 await page.getByRole('button',{name:"I'm in",exact:true}).click({timeout:30000});
 await page.waitForURL('**/pending',{timeout:30000});
 await page.getByText("A real person will review your application before you're let in.").waitFor();
 await page.getByText('Error saving data',{exact:true}).waitFor({state:'hidden'});
 await page.screenshot({path:'docs/release-completion/screenshots/staging-pending-390.png',animations:'allow',timeout:15000});
 await page.waitForTimeout(2000);
 assert.ok(page.url().endsWith('/pending'),'Pending screen must stay stable without a redirect loop');
 assert.deepEqual(errors,[]);console.log('Real staging onboarding reached a stable pending screen without page errors');
}finally{await browser.close();}
