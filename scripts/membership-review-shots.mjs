import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {bridgeDb,addUser} from './creative-bridge-fixture.mjs';
import {backend,signIn} from './creative-bridge-backend.mjs';
const out='docs/membership-review/screenshots';mkdirSync(out,{recursive:true});
const {db}=await bridgeDb();const uid='00000000-0000-4000-8000-00000000aa01';
await addUser(db,uid,'Maya Torres','atlanta|ga',{access_status:'pending',onboarding_completed:false});
const browser=await chromium.launch({channel:'chrome'});const errors=[];
try{
 for(const width of [390,820,1280]){
  const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',colorScheme:'dark'});await signIn(c,uid);
  await c.addInitScript(id=>localStorage.setItem(`ether-onboarding-draft:${id}`,JSON.stringify({version:3,step:3,data:{displayName:'Maya Torres',memberOf:'',passions:['Photography'],passionSeriousness:5,city:'Atlanta',cityDisplay:'Atlanta, GA',cityKey:'atlanta|ga',skills:[],roles:[],questionnaireResponses:{},socialProfile:'',website:''}})),uid);
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await backend(db)(p);
  await p.goto('http://127.0.0.1:8130/onboarding');await p.getByRole('heading',{name:'Show us your work'}).waitFor();
  await p.getByRole('button',{name:'Continue to oath'}).click();await p.getByRole('alert').waitFor();
  await p.locator('#application-social').fill('instagram.com/mayatorres');await p.getByRole('button',{name:'Continue to oath'}).click();await p.getByRole('alert').waitFor();
  await p.locator('#application-website').fill('mayatorres.example.com');
  await p.screenshot({path:`${out}/application-links-${width}.png`,fullPage:true});
  await p.getByRole('button',{name:'Continue to oath'}).click();await p.getByRole('button',{name:"I'm in",exact:true}).waitFor();await p.waitForTimeout(350);
  const box=await p.getByAltText('Ether',{exact:true}).boundingBox();assert.ok(Math.abs(box.x+box.width/2-width/2)<2,'Wordmark centered');
  await p.screenshot({path:`${out}/oath-${width}.png`,fullPage:true});
  await db.query('UPDATE profiles SET onboarding_completed=true WHERE user_id=$1',[uid]);await p.goto('http://127.0.0.1:8130/pending');await p.getByRole('button',{name:'Watch the ETHER film'}).waitFor();
  assert.equal(await p.locator('video').count(),0,'No autoplay before consent');
  await p.screenshot({path:`${out}/pending-${width}.png`,fullPage:true});
  await p.getByRole('button',{name:'Watch the ETHER film'}).click();await p.locator('video').waitFor();
  await p.waitForFunction(()=>document.querySelector('video')?.currentTime>0,{},{timeout:15000});
  assert.equal(await p.locator('track[kind=captions]').count(),1);
  await p.screenshot({path:`${out}/film-playing-${width}.png`,fullPage:true});
  await p.getByRole('button',{name:'Close film',exact:true}).click();assert.equal(await p.locator('video').count(),0,'Close stops video and audio');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await c.close();await db.query('UPDATE profiles SET onboarding_completed=false WHERE user_id=$1',[uid]);console.log(`${width}px: both links required, logo centered, optional film plays with captions and closes`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await db.close();}
