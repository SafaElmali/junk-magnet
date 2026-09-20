// Controlled fixtures exercise production UI and simulation modules without adding gameplay cheats.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.GAME_URL ?? 'http://127.0.0.1:5197';
const out = '/tmp/junk-magnet-drone-upgrades';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], reports = [];
try {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390], [568, 320]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900 });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/drone-upgrade-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <div id="app" class="in-run"><div id="yard"></div><div class="ability-loadout"></div><div class="upgrade hidden" id="upgrade"><div class="upgrade-sheet"><header class="upgrade-heading"><div><h2>Choose an upgrade</h2><p id="upgrade-copy">Controlled rank progression fixture</p></div></header><div id="upgrade-choices" class="upgrade-choices"></div></div></div></div>
      <script type="module">
      import '/src/style.css'; import '/src/play-hud.css'; import '/src/level-up.css';
      import '/node_modules/@fontsource/barlow-condensed/latin-700.css'; import '/node_modules/@fontsource/dm-sans/latin-500.css';
      import {createState,chooseUpgrade} from '/src/simulation.ts';
      import {setDroneMode,updateDrone,DRONE_UPGRADES} from '/src/drone.ts';
      import {FieldControls} from '/src/field-controls.ts';
      import {upgradeChoicesMarkup} from '/src/level-up.ts';
      import {abilityLoadoutMarkup} from '/src/ability-loadout.ts';
      import {setLanguage} from '/src/i18n.ts';
      import {YardScene} from '/src/scene.ts';
      const state=createState(); state.phase='playing'; state.openingRemaining=0; state.time=10;
      const controls=new FieldControls(document.querySelector('#app'),mode=>{setDroneMode(state,mode);render();});
      const scene=new YardScene(document.querySelector('#yard')); await scene.load(()=>{}); scene.resize();
      function render(){controls.update(state,true); document.querySelector('.ability-loadout').innerHTML=abilityLoadoutMarkup(state); scene.render(state,0);}
      document.querySelector('#upgrade-choices').onclick=e=>{const id=e.target.closest('[data-upgrade]')?.dataset.upgrade; if(id){chooseUpgrade(state,id); document.querySelector('#upgrade').classList.add('hidden');render();}};
      window.fixture={state,render,setLanguage,updateDrone,scene,droneUpgrades:DRONE_UPGRADES,offer(){state.phase='upgrade';state.choices=Object.values(DRONE_UPGRADES).filter(id=>state.upgrades[id]<3);document.querySelector('#upgrade-choices').innerHTML=upgradeChoicesMarkup(state);document.querySelector('#upgrade').classList.remove('hidden');}};
      render();
      </script>` }));
    await page.goto(`${origin}/drone-upgrade-fixture`);
    await page.waitForFunction(() => window.fixture);
    // Real choices advance only their role and appear separately in the build strip.
    for (let rank = 1; rank <= 3; rank++) for (const mode of ['collector','repair','guard']) {
      const before = await page.evaluate(mode => {
        const f=window.fixture; f.state.drone.mode=mode; f.render(); f.offer();
        return { ...f.state.upgrades };
      }, mode);
      const id = `drone_${mode}`;
      const card = page.locator(`[data-upgrade="${id}"]`);
      assert.equal(await card.locator('.upgrade-pips i').count(), 3);
      await card.locator('img').evaluate(i => i.decode());
      if (rank === 3 && mode === 'collector') await page.screenshot({ path: `${out}/separate-role-choices-${width}.png` });
      await card.click();
      assert.equal(await page.locator('.drone-control').getAttribute('data-rank'), String(rank));
      assert.equal(await page.locator(`[data-owned-ability="${id}"] b`).textContent(), String(rank));
      const after = await page.evaluate(() => window.fixture.state.upgrades);
      assert.deepEqual(after, { ...before, [id]: rank });
    }
    const checks = await page.evaluate(() => {
      const f = window.fixture, failures = [];
      for (const language of ['en','tr','de','fr','es','pt']) for (const rank of [0,1,2,3]) for (const mode of ['collector','repair','guard']) {
        f.setLanguage(language); f.state.upgrades[f.droneUpgrades[mode]]=rank; f.state.drone.mode=mode; f.render();
        const button=document.querySelector('.drone-control'), copy=button.querySelector('.drone-control-copy');
        const r=button.getBoundingClientRect();
        if(r.left<0 || r.right>innerWidth || r.bottom>innerHeight || button.scrollWidth>button.clientWidth || copy.scrollWidth>copy.clientWidth)
          failures.push({language,rank,mode,rect:{x:r.x,y:r.y,w:r.width,h:r.height}});
        if(button.dataset.rank!==String(rank)) failures.push({language,rank,mode,shown:button.dataset.rank});
        if(!button.getAttribute('aria-label') || /undefined|\{\w+\}/.test(button.textContent)) failures.push({language,rank,mode,copy:button.textContent});
      }
      f.setLanguage('en'); f.state.upgrades.drone_repair=3; f.state.drone.mode='repair'; f.state.hp=20; f.state.drone.actionTimer=10;
      f.updateDrone(f.state,.01,{damage:()=>{},emit:()=>{}}); f.render();
      return {failures,hp:f.state.hp,used:f.state.drone.emergencyUsed,text:document.querySelector('.drone-status').textContent};
    });
    assert.deepEqual(checks.failures, []);
    assert.equal(checks.hp, 40);
    assert.equal(checks.used, true);
    assert.equal(checks.text, 'Emergency heal used');
    await page.screenshot({ path: `${out}/rank-three-repair-${width}.png` });
    reports.push({ width, height, combinations: 72, ...checks });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ reports, errors }, null, 2));
  console.log(JSON.stringify({ layouts: reports.length, localizedRoleRankChecks: reports.length * 72, errors, out }));
} finally { await browser.close(); }
