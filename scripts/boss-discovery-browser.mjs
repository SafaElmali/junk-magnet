// Controlled real-renderer fixtures, not a natural gameplay capture.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.GAME_URL ?? 'http://127.0.0.1:5184';
const out = '.impeccable/review';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
try {
  for (const [width, height] of [[1440,900], [390,844], [844,390]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900 });
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    page.on('requestfailed', request => console.error(request.url(), request.failure()?.errorText));
    await page.route('**/boss-discovery-fixture', route => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#yard{margin:0;width:100%;height:100%;overflow:hidden}aside{position:fixed;bottom:12px;left:12px;padding:8px 12px;background:#173342;color:#fff4d8;font:12px sans-serif;pointer-events:none}</style><div id="yard"></div><aside>CONTROLLED RENDERER FIXTURE</aside><script type="module">
      import {YardScene} from '/src/scene.ts';
      import {createState} from '/src/simulation.ts';
      import {updateDiscovery,getDiscoveryHint} from '/src/discovery.ts';
      const scene=new YardScene(document.querySelector('#yard')); await scene.load(()=>{}); scene.resize();
      const state=createState(); state.phase='playing'; state.time=20; state.openingRemaining=0; state.pickups=[];
      state.player={x:0,z:3};
      const enemyZ=innerHeight<500?0:-3;
      state.enemies=[{id:1,type:'boss',x:-2.7,z:enemyZ,hp:220,hit:0,seed:0},{id:2,type:'miniboss',x:2.4,z:enemyZ,hp:85,hit:0,seed:0}];
      state.discovery.points=state.discovery.points.filter(p=>p.sector===0);
      for(const p of state.discovery.points){p.x=p.kind==='repair'?-3:p.kind==='chest'?0:3;p.z=2;}
      function render(){scene.render(state,0);}
      window.fixture={scene,state,render,updateDiscovery,getDiscoveryHint};render();
      </script>`
    }));
    await page.goto(`${origin}/boss-discovery-fixture`);
    await page.waitForFunction(() => window.fixture);
    const ready = await page.evaluate(() => {
      const {scene,state}=window.fixture;
      return {mobile:scene.mobile, boss:scene.bossBatches.boss.map(b=>b.count), mini:scene.bossBatches.miniboss.map(b=>b.count), ordinary:scene.enemyBatches.map(b=>b.count), rendered:scene.diagnostics().renderedEnemies, markers:scene.expansion.discovery.slots.filter(s=>s.root.visible&&s.unavailable.visible).length};
    });
    assert.ok(ready.boss.length >= 5 && ready.boss.every(n=>n===1));
    assert.ok(ready.mini.length >= 5 && ready.mini.every(n=>n===1));
    assert.ok(ready.ordinary.every(n=>n===0));
    assert.equal(ready.rendered,2);
    assert.equal(ready.markers,0);
    await page.screenshot({path:`${out}/boss-discovery-${width}-ready.png`});
    const used=await page.evaluate(() => {
      const f=window.fixture;
      f.state.hp=35;
      for(const p of [...f.state.discovery.points]) {
        f.state.player={x:p.x,z:p.z};
        f.updateDiscovery(f.state,p.kind==='salvage'?8.1:1.3);
      }
      f.state.time+=6;
      f.state.player={x:0,z:3};
      f.render();
      const slots=f.scene.expansion.discovery.slots.filter(s=>s.root.visible);
      return {completed:f.state.discovery.points.every(p=>p.completed), markers:slots.filter(s=>s.unavailable.visible).length, rings:slots.filter(s=>s.ring.visible).length, muted:slots.every(s=>s.surfaces.every(p=>p.mesh.material!==p.original)), hint:f.getDiscoveryHint(f.state)};
    });
    assert.equal(used.completed,true);
    assert.equal(used.markers,3);
    assert.equal(used.rings,0);
    assert.equal(used.muted,true);
    assert.equal(used.hint.mode,'complete');
    await page.screenshot({path:`${out}/boss-discovery-${width}-spent.png`});
    // Warm both material states, then ensure repeated pooling/reset does not grow GPU geometry.
    const stable=await page.evaluate(() => {
      const f=window.fixture;
      for(let i=0;i<4;i++) {
        for(const p of f.state.discovery.points)p.completed=i%2===0;
        f.render();
      }
      const before=f.scene.diagnostics().geometries;
      for(let i=0;i<20;i++) {
        for(const p of f.state.discovery.points)p.completed=i%2===0;
        f.render();
      }
      const after=f.scene.diagnostics().geometries;
      f.state.enemies=[]; f.render();
      const removed=[...f.scene.bossBatches.boss,...f.scene.bossBatches.miniboss].every(b=>b.count===0);
      f.scene.clear();
      return {before,after,removed};
    });
    assert.equal(stable.before,stable.after);
    assert.equal(stable.removed,true);
    results.push({width,height,ready,used,stable});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${out}/boss-discovery.json`,JSON.stringify({fixture:true,results,errors},null,2));
  console.log(JSON.stringify({passed:true,results,errors},null,2));
} finally { await browser.close(); }
