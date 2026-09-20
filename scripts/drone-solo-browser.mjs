import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const url=process.env.GAME_URL ?? process.argv[2] ?? 'http://127.0.0.1:5197';
const errors=[],reports=[];
await fs.mkdir('.impeccable/review/drone',{recursive:true});
const read=p=>p.evaluate(()=>window.__JUNK_MAGNET__.snapshot());
try {
 for (const [name, viewport, mobile] of [['desktop',{width:1440,height:900},false],['portrait',{width:390,height:844},true],['small-phone',{width:320,height:568},true],['landscape',{width:844,height:390},true],['small-landscape',{width:568,height:320},true]]) {
  const p=await browser.newPage({viewport,locale:'tr-TR',hasTouch:mobile,isMobile:mobile});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);
  const asset = await p.request.get(url + '/models/helper-drone.glb');
  assert.equal(asset.status(),200); assert.equal((await asset.body()).subarray(0,4).toString(),'glTF');
  await p.locator('#start').click();
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
  await p.screenshot({path:`.impeccable/review/drone/${name}.png`});
  if(!mobile){
   await p.keyboard.down('KeyD'); await p.waitForTimeout(2150); await p.keyboard.up('KeyD');
   assert.ok((await read(p)).player.x>10);
   assert.equal(await p.locator('#region-label').count(),0);
   await p.screenshot({path:'.impeccable/review/drone/scrapyard.png'});
   await p.keyboard.press('Escape');
   const paused=await read(p); await p.waitForTimeout(300);
   assert.equal((await read(p)).time,paused.time);
   assert.equal(await p.locator('.field-controls').isVisible(),false);
  }
  reports.push({name,layout}); await p.close();
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile('.impeccable/review/drone/report.json',JSON.stringify({url,reports,errors},null,2));
 console.log(JSON.stringify({layouts:reports.map(r=>r.name),errors}));
}finally{await browser.close();}
