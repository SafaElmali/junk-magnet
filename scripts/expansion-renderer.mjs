// Explicit source-renderer fixture. Real simulation updates generate attacks; controlled
// enemies/configs place the expanded features together. This is not natural gameplay.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const origin = process.env.GAME_URL ?? "http://127.0.0.1:5184";
const directory = ".impeccable/review";
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [],
  errors = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/expansion-renderer-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#yard{margin:0;width:100%;height:100%;overflow:hidden}aside{position:fixed;left:12px;top:12px;padding:8px 12px;background:#142f37;color:#fff4d8;font:12px sans-serif;pointer-events:none;border:1px solid #e7b64d}</style><div id="yard"></div><aside>ISOLATED RENDERER FIXTURE · <span id="stage"></span></aside><script type="module">
import {YardScene} from '/src/scene.ts';
import {createState,update} from '/src/simulation.ts';
import {ROBOTS} from '/src/progression.ts';
const scene=new YardScene(document.querySelector('#yard'));await scene.load(()=>{});scene.setQuality('high');scene.resize();
function prepare(robotId='scrap') {
  const config=ROBOTS.find(r=>r.id===robotId);const s=createState({...config,robotId});
  s.phase='playing';s.openingRemaining=0;s.enemies=[];s.pickups=[];s.spawnTimer=Infinity;s.encounters.nextAt=Infinity;s.pulseTimer=Infinity;s.immunity=100;
  s.upgrades={saw:5,lightning:5,turret:5,burst:5,boots:4,magnet:4,armor:4,repair:0,refill:0,overclock:0};s.evolutions={vortex:true,storm:true,fortress:true};
  const mobile=innerWidth<500;
  const positions=mobile ? [['charger',-3,3],['spitter',3,2],['warden',0,-5],['miniboss',-3,-6],['boss',3,-8]] : [['charger',-6,2],['spitter',6,2],['warden',0,-7],['miniboss',-5,-4],['boss',5,-5]];
  for(const [type,x,z] of positions)s.enemies.push({id:s.nextId++,type,x,z,hp:10000,hit:0,seed:0});
  return s;
}
function step(state,frames){for(let i=0;i<frames;i++){update(state,.05,{x:0,z:0});scene.events(state.events.splice(0),state);scene.render(state,state.phase==='playing'?.05:0);}}
function bodyColors(id){const colors=[];const model=id?scene.robotModels.get(id):[...scene.robotModels.values()].find(m=>m.visible);model.traverse(o=>{if(o.isMesh)for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material.name==='Butter yellow'||material.name.includes('enamel'))colors.push(material.color.getHexString());});return [...new Set(colors)];}
window.fixture={scene,prepare,step,bodyColors,originalBodyColors:Object.fromEntries(['scrap','scout','volt'].map(id=>[id,bodyColors(id)])),state:prepare()};</script>`,
      }),
    );
    await page.goto(`${origin}/expansion-renderer-fixture`);
    await page.waitForFunction(() => window.fixture, { timeout: 30000 });
    for (const robotId of ["scrap", "scout", "volt"]) {
      const warnings = await page.evaluate((robotId) => {
        const f = window.fixture;
        f.scene.clear();
        f.state = f.prepare(robotId);
        f.step(f.state, 28);
        document.querySelector("#stage").textContent =
          robotId.toUpperCase() + " / TELEGRAPHS";
        const v = f.scene.expansion,
          e = v.encounters;
        const visible = e.warnings.filter((w) => w.group.visible);
        return {
          robotId,
          bodyColors: f.bodyColors(),
          originalBodyColors: f.originalBodyColors,
          warningKinds: f.state.encounters.warnings.map((w) => w.kind),
          visibleWarnings: visible.length,
          cyclone: v.cyclone.visible,
          cycloneBlades: v.cyclone.children.length,
          scout: f.scene.robotModels.get("scout").visible,
          volt: f.scene.robotModels.get("volt").visible,
          accents: v.accents.count,
          geometries: f.scene.diagnostics().geometries,
          allVisibleMeshes: visible.every(
            (w) => w.ring.isMesh && w.lane.isMesh,
          ),
          warningColor: visible[0]?.ring.material.color.getHex(),
          warningOpacity: visible[0]?.lane.material.opacity,
        };
      }, robotId);
      assert.ok(
        warnings.originalBodyColors[robotId].length > 0,
        "Each robot must have its own enamel shell material",
      );
      assert.deepEqual(
        warnings.bodyColors,
        warnings.originalBodyColors[robotId],
      );
      assert.ok(warnings.visibleWarnings >= 3);
      assert.ok(warnings.warningKinds.includes("charge"));
      assert.ok(warnings.warningKinds.includes("zone"));
      assert.ok(warnings.warningKinds.includes("bolt"));
      assert.equal(warnings.cyclone, true);
      assert.equal(warnings.cycloneBlades, 6);
      assert.ok(warnings.accents >= 10);
      assert.equal(warnings.allVisibleMeshes, true);
      assert.equal(warnings.scout, robotId === "scout");
      assert.equal(warnings.volt, robotId === "volt");
      await page.screenshot({
        path: `${directory}/expansion-fixture-${width}-${robotId}-warnings.png`,
      });
      const pause = await page.evaluate(() => {
        const f = window.fixture;
        f.state.phase = "paused";
        const stateBefore = JSON.stringify(f.state),
          meshesBefore = JSON.stringify(
            f.scene.expansion.encounters.warnings.map((w) => ({
              visible: w.group.visible,
              position: w.group.position.toArray(),
              scale: w.fill.scale.toArray(),
            })),
          ),
          cycloneBefore = JSON.stringify(
            f.scene.expansion.cyclone.children.map((c) => c.position.toArray()),
          );
        for (let i = 0; i < 8; i++) {
          f.step(f.state, 1);
          f.scene.render(f.state, 0);
        }
        return {
          stateFrozen: stateBefore === JSON.stringify(f.state),
          warningsFrozen:
            meshesBefore ===
            JSON.stringify(
              f.scene.expansion.encounters.warnings.map((w) => ({
                visible: w.group.visible,
                position: w.group.position.toArray(),
                scale: w.fill.scale.toArray(),
              })),
            ),
          cycloneFrozen:
            cycloneBefore ===
            JSON.stringify(
              f.scene.expansion.cyclone.children.map((c) =>
                c.position.toArray(),
              ),
            ),
        };
      });
      assert.deepEqual(pause, {
        stateFrozen: true,
        warningsFrozen: true,
        cycloneFrozen: true,
      });
      const active = await page.evaluate(() => {
        const f = window.fixture;
        f.state.phase = "playing";
        f.step(f.state, 27);
        document.querySelector("#stage").textContent =
          f.state.config.robotId.toUpperCase() + " / ACTIVE HAZARDS";
        const e = f.scene.expansion.encounters;
        return {
          zones: f.state.encounters.zones.length,
          visibleZones: e.zones.filter((z) => z.group.visible).length,
          projectiles: f.state.encounters.projectiles.length,
          projectileInstances: e.bolts.count,
          warningPool: e.warnings.length,
          zonePool: e.zones.length,
        };
      });
      assert.ok(active.zones > 0);
      assert.equal(active.visibleZones, active.zones);
      assert.equal(active.projectileInstances, active.projectiles);
      assert.equal(active.warningPool, 32);
      assert.equal(active.zonePool, 12);
      await page.screenshot({
        path: `${directory}/expansion-fixture-${width}-${robotId}-hazards.png`,
      });
      results.push({ width, height, ...warnings, pause, active });
    }
    const variants = await page.evaluate(() => {
      const f = window.fixture;
      const switches = [];
      for (const robotId of ["volt", "scout", "scrap", "volt", "scrap"]) {
        f.scene.clear();
        f.state = f.prepare(robotId);
        f.scene.render(f.state, 0);
        switches.push({ robotId, colors: f.bodyColors() });
      }
      const damage = [];
      for (const robotId of ["scrap", "scout", "volt"]) {
        f.scene.clear();
        f.state = f.prepare(robotId);
        f.scene.render(f.state, 0);
        const before = f.bodyColors();
        f.scene.events([{ kind: "hurt", ...f.state.player }], f.state);
        f.state.time += 0.1;
        f.scene.render(f.state, 0.1);
        const tinted = f.bodyColors();
        f.state.time += 0.9;
        f.scene.render(f.state, 0.9);
        damage.push({ robotId, before, tinted, recovered: f.bodyColors() });
      }
      return { original: f.originalBodyColors, switches, damage };
    });
    for (const { robotId, colors } of variants.switches)
      assert.deepEqual(colors, variants.original[robotId]);
    for (const { before, tinted, recovered } of variants.damage) {
      assert.notDeepEqual(tinted, before);
      assert.deepEqual(recovered, before);
    }
    results.push({ width, variants });
    const memory = await page.evaluate(() => {
      const f = window.fixture;
      // Warm every attack, robot model and discovery geometry before measuring.
      for (const id of ["scrap", "scout", "volt"]) {
        f.state = f.prepare(id);
        f.step(f.state, 55);
      }
      f.scene.clear();
      f.state = f.prepare();
      f.scene.render(f.state, 0);
      const before = f.scene.diagnostics().geometries;
      for (let i = 0; i < 6; i++) {
        f.scene.clear();
        f.state = f.prepare(["scrap", "scout", "volt"][i % 3]);
        f.step(f.state, 28);
        f.step(f.state, 27);
      }
      f.scene.clear();
      f.state = f.prepare();
      f.scene.render(f.state, 0);
      const after = f.scene.diagnostics().geometries;
      f.scene.clear();
      f.state = f.prepare();
      f.state.enemies = [];
      f.state.evolutions = { vortex: false, storm: false, fortress: false };
      f.scene.render(f.state, 0);
      const v = f.scene.expansion;
      return {
        before,
        after,
        resetWarnings: v.encounters.warnings.filter((w) => w.group.visible)
          .length,
        resetZones: v.encounters.zones.filter((z) => z.group.visible).length,
        resetProjectiles: v.encounters.bolts.count,
        resetAccents: v.accents.count,
        resetCyclone: v.cyclone.visible,
      };
    });
    assert.equal(
      memory.before,
      memory.after,
      "repeated fixtures/resets must not grow geometry",
    );
    assert.equal(memory.resetWarnings, 0);
    assert.equal(memory.resetZones, 0);
    assert.equal(memory.resetProjectiles, 0);
    assert.equal(memory.resetAccents, 0);
    assert.equal(memory.resetCyclone, false);
    results.push({ width, memory });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    `${directory}/expansion-renderer.json`,
    JSON.stringify(
      {
        fixture: true,
        description:
          "Isolated real-source renderer; configured high-health enemies and full evolutions; attacks advanced by actual update()",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: true, viewports: 2, robots: 3, results, errors }),
  );
} finally {
  await browser.close();
}
