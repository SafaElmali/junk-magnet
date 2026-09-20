// Controlled renderer fixture: real simulation emits the chain-lightning events.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [],
  errors = [];
await fs.mkdir(".impeccable/review", { recursive: true });
try {
  for (const [width, height, reduced] of [
    [1440, 900, false],
    [390, 844, false],
    [844, 390, false],
    [390, 844, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 900,
      hasTouch: width < 900,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/lightning-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#yard{width:100%;height:100%;margin:0;overflow:hidden}</style><div id="yard"></div><script type="module">
      import {YardScene} from '/src/scene.ts';
      import {createState,update} from '/src/simulation.ts';
      const scene=new YardScene(document.querySelector('#yard')); await scene.load(()=>{}); scene.setQuality(innerWidth<900?'performance':'high');scene.resize();
      const state=createState(); state.phase='playing';state.enemies=[];state.pickups=[];state.spawnTimer=Infinity;state.encounters.nextAt=Infinity;state.pulseTimer=Infinity;state.immunity=100;
      state.upgrades.lightning=5;
      for(const [x,z] of [[-2,-2],[1,-4],[3,-2],[2,1]]) state.enemies.push({id:state.nextId++,type:'can',x,z,hp:10000,hit:0,seed:0});
      update(state,.016,{x:0,z:0});
      const events=state.events.filter(e=>e.kind==='lightning');scene.events(events,state);scene.render(state,.04);
      window.fixture={scene,state,events};
    </script>`,
      }),
    );
    await page.goto("http://127.0.0.1:5184/lightning-fixture");
    await page.waitForFunction(() => window.fixture);
    const first = await page.evaluate(() => {
      const f = window.fixture;
      const before = JSON.stringify(f.scene.lightning.arcs);
      f.scene.render(f.state, 0);
      return {
        events: f.events.length,
        ...f.scene.diagnostics().attackFx.lightning,
        pauseStable: before === JSON.stringify(f.scene.lightning.arcs),
        geometries: f.scene.diagnostics().geometries,
        reduced: f.scene.reduced,
      };
    });
    assert.equal(first.events, 4);
    assert.equal(first.arcs, 4);
    assert.ok(first.segments > 40);
    assert.equal(first.pauseStable, true);
    assert.equal(first.reduced, reduced);
    await page.screenshot({
      path: `.impeccable/review/lightning-${width}${reduced ? "-reduced" : ""}.png`,
    });
    const stress = await page.evaluate(() => {
      const f = window.fixture;
      for (let round = 0; round < 50; round++) {
        f.scene.events(
          Array.from({ length: 80 }, (_, i) => f.events[i % f.events.length]),
          f.state,
        );
        f.scene.render(f.state, 0.016);
      }
      const peak = f.scene.diagnostics();
      for (let i = 0; i < 25; i++) f.scene.render(f.state, 0.016);
      const expired = f.scene.diagnostics().attackFx.lightning;
      f.scene.events(f.events, f.state);
      f.scene.render(f.state, 0.016);
      f.scene.clear();
      return {
        peak: peak.attackFx.lightning,
        geometries: peak.geometries,
        expired,
        cleared: f.scene.diagnostics().attackFx.lightning,
      };
    });
    assert.ok(stress.peak.arcs <= 40);
    assert.ok(stress.peak.segments <= 960);
    assert.equal(stress.geometries, first.geometries);
    assert.equal(stress.expired.arcs, 0);
    assert.equal(stress.expired.segments, 0);
    assert.equal(stress.cleared.arcs, 0);
    assert.equal(stress.cleared.segments, 0);
    results.push({ width, height, reduced, first, stress });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    ".impeccable/review/lightning-browser.json",
    JSON.stringify({ fixture: true, results, errors }, null, 2),
  );
  console.log(
    "PASS: four renderer fixtures; chain events, pause, expiry, reset and bounded GPU geometry.",
  );
} finally {
  await browser.close();
}
