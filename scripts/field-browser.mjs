import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const url=process.env.GAME_URL ?? process.argv[2] ?? 'http://127.0.0.1:5185/play/';
const errors=[],reports=[];
await fs.mkdir('.impeccable/review/field',{recursive:true});
const read=p=>p.evaluate(()=>window.__JUNK_MAGNET__.snapshot());
try {
 for (const [name, viewport, mobile] of [['desktop',{width:1440,height:900},false],['portrait',{width:390,height:844},true],['small-phone',{width:320,height:568},true],['landscape',{width:844,height:390},true],['small-landscape',{width:568,height:320},true]]) {
  const p=await browser.newPage({viewport,locale:'tr-TR',hasTouch:mobile,isMobile:mobile});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url); await p.locator('#start').click();
  await p.locator('.drone-control').waitFor({state:'visible'});
  assert.equal(await p.locator('#polarity-action').count(),0);
  assert.equal(await p.locator('#region-label').count(),0);
  await p.locator('.drone-control').click();
  assert.equal((await read(p)).drone.mode,'repair');
  await p.waitForTimeout(450);
  await p.keyboard.press('KeyQ');
  assert.equal((await read(p)).drone.mode,'guard');
  await p.locator('#yard').focus();
  await p.keyboard.press('Space');
  assert.equal((await read(p)).polarity,undefined);
  assert.equal((await read(p)).world.polarity,undefined);
  const visual=await read(p);
  assert.equal(visual.world.drones.local,true);
  assert.equal(visual.world.regions,undefined);
  assert.equal(visual.world.chunks,9);
  const layout=await p.locator('.field-controls').evaluate(el=>{
   const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,buttons:[...el.querySelectorAll('button')].map(b=>({height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}))};
  });
  assert.ok(layout.x>=0&&layout.bottom<=layout.h&&layout.right<=layout.w);
  assert.ok(layout.buttons.every(b=>b.height>=48&&b.width>=48));
  await p.screenshot({path:`.impeccable/review/field/${name}.png`});
  if(!mobile){
   await p.keyboard.down('KeyD'); await p.waitForTimeout(2150); await p.keyboard.up('KeyD');
   assert.ok((await read(p)).player.x>10);
   assert.equal(await p.locator('#region-label').count(),0);
   await p.screenshot({path:'.impeccable/review/field/scrapyard.png'});
   await p.keyboard.press('Escape');
   const paused=await read(p); await p.waitForTimeout(300);
   assert.equal((await read(p)).time,paused.time);
   assert.equal(await p.locator('.field-controls').isVisible(),false);
  }
  reports.push({name,layout}); await p.close();
 }
 // Real two-client server authority, independent helper modes.
 const a=await browser.newPage({viewport:{width:1280,height:800},locale:'tr-TR'}), b=await browser.newPage({viewport:{width:390,height:844},locale:'tr-TR',hasTouch:true,isMobile:true});
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message)); await p.goto(url);await p.locator('#menu-coop').click();}
 await a.locator('[data-coop=create]').click();
 const code=await a.locator('.coop-room-code strong').textContent();
 await b.locator('#coop-code').fill(code);await b.locator('[data-coop=join]').click();
 await a.locator('[data-coop=start]').click();
 for(const p of [a,b])await p.waitForFunction(()=>window.__JUNK_MAGNET__.snapshot().coop.active);
 await a.locator('.drone-control').click();
 await a.waitForFunction(()=>window.__JUNK_MAGNET__.snapshot().drone.mode==='repair');
 assert.equal((await read(b)).drone.mode,'collector');
 assert.equal((await read(b)).world.drones.partner,true);
 const overlaps=await b.evaluate(()=>{
  const overlap=(a,b)=>{const x=document.querySelector(a),y=document.querySelector(b);if(!x?.getClientRects().length||!y?.getClientRects().length)return false;const r=x.getBoundingClientRect(),s=y.getBoundingClientRect();return r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top;};
  return {receipt:overlap('.field-controls','#world-hint')};
 });
 assert.deepEqual(overlaps,{receipt:false});
 await b.screenshot({path:'.impeccable/review/field/coop-mobile.png'});
 assert.deepEqual(errors,[]);
 await fs.writeFile('.impeccable/review/field/report.json',JSON.stringify({url,reports,coop:true,errors},null,2));
 console.log(JSON.stringify({layouts:reports.map(r=>r.name),coop:true,errors}));
}catch(error){
 console.error(JSON.stringify({errors}));
 for(const context of browser.contexts()) for(const p of context.pages()) {
  await p.screenshot({path:'.impeccable/review/field/failure.png'}).catch(()=>{});
  console.error(await p.evaluate(()=>({phase:window.__JUNK_MAGNET__?.snapshot().phase,text:document.body.innerText.slice(-1200)})).catch(()=>null));
 }
 throw error;
}finally{await browser.close();}
