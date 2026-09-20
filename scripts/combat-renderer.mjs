// Isolated renderer fixture. Deliberately imports source modules; no app mutation hooks.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const directory = ".impeccable/review";
await fs.mkdir(directory, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/combat-renderer-fixture", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: `<style>html,body,#yard{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="yard"></div><script type="module">
import {YardScene} from '/src/scene.ts'; import {createState} from '/src/simulation.ts';
const scene=new YardScene(document.querySelector('#yard')); await scene.load(()=>{}); scene.resize(); const state=createState(); state.openingRemaining=0; state.phase='playing'; state.time=20; state.pickups=[];state.scrap=4;
state.enemies=[{id:1,x:3,z:0,hp:20,hit:0,seed:1,type:'can'}];
state.shots=[{id:2,x:-2,z:1,vx:-7,vz:0,life:1,kind:0},{id:3,x:1,z:-2,vx:3,vz:-7,life:1,kind:1},{id:4,x:2,z:2,vx:7,vz:5,life:1,kind:2}];
window.fixture={scene,state};</script>`,
  }),
);
try {
  await page.goto(
    `${process.env.GAME_URL ?? "http://127.0.0.1:5184"}/combat-renderer-fixture`,
  );
  await page.waitForFunction(() => window.fixture, { timeout: 30000 });
  const results = [];
  for (const quality of ["performance", "balanced", "high", "ultra"]) {
    const result = await page.evaluate((quality) => {
      const { scene, state } = window.fixture;
      scene.setQuality(quality);
      scene.clear();
      scene.events(
        [
          { kind: "pulse", x: 3, z: 0 },
          { kind: "hit", x: 3, z: 0 },
        ],
        state,
      );
      scene.render(state, 0);
      const active = scene.diagnostics();
      const pulseMesh = scene.pulse.children.every((child) => child.isMesh);
      scene.render(state, 0);
      const paused = scene.diagnostics();
      scene.render(state, 0.4);
      const expired = scene.diagnostics();
      for (let i = 0; i < 28; i++)
        scene.events([{ kind: "hit", x: 3, z: 0 }], state);
      scene.render(state, 0);
      const bounded = scene.diagnostics();
      const memory = bounded.geometries;
      for (let i = 0; i < 12; i++) {
        scene.events(
          [
            { kind: "pulse", x: 3, z: 0 },
            { kind: "hit", x: 3, z: 0 },
          ],
          state,
        );
        scene.render(state, 0.3);
      }
      const after = scene.diagnostics();
      scene.clear();
      const cleared = scene.diagnostics();
      scene.events(
        [
          { kind: "pulse", x: 3, z: 0 },
          { kind: "hit", x: 3, z: 0 },
        ],
        state,
      );
      scene.render(state, 0);
      return {
        quality,
        active,
        paused,
        expired,
        bounded: bounded.attackFx,
        stableGeometry: memory === after.geometries,
        cleared: cleared.attackFx,
        pulseMesh,
      };
    }, quality);
    assert.equal(result.pulseMesh, true);
    assert.equal(result.active.attackFx.shotTrails, 3);
    assert.equal(result.active.attackFx.pulseVisible, true);
    assert.equal(result.active.attackFx.pulseWidth, 0.28);
    assert.deepEqual(
      result.paused.attackFx,
      result.active.attackFx,
      "pause freezes effects",
    );
    assert.equal(result.expired.attackFx.pulseVisible, false);
    assert.equal(result.expired.attackFx.impacts, 0);
    assert.equal(result.bounded.impacts, 24);
    assert.equal(
      result.stableGeometry,
      true,
      "repeated attacks allocate no new GPU geometry",
    );
    assert.equal(result.cleared.pulseVisible, false);
    assert.equal(result.cleared.shotTrails, 0);
    assert.equal(result.cleared.impacts, 0);
    if (quality === "high")
      await page.screenshot({ path: `${directory}/combat-renderer-1440.png` });
    results.push(result);
  }
  const reduced = await page.evaluate(() => {
    const { scene, state } = window.fixture;
    scene.reduced = true;
    scene.events([{ kind: "pulse", x: 3, z: 0 }], state);
    scene.render(state, 0);
    return scene.diagnostics().attackFx;
  });
  assert.equal(reduced.pulseVisible, true);
  assert.equal(reduced.shotTrails, 3);
  const barrels = await page.evaluate(async () => {
    const { scene, state } = window.fixture;
    const { Color } = await import("/node_modules/three/build/three.module.js");
    const samples = [];
    for (const x of [0, 11, 21, 31, 0]) {
      state.player.x = x;
      scene.render(state, 0);
      samples.push(
        scene.diagnostics().barrels.map((p, i) => {
          const color = new Color();
          scene.salvageBatch.getColorAt(i, color);
          return { ...p, actual: color.getHex() };
        }),
      );
    }
    return samples;
  });
  const colors = new Map();
  let repeated = 0;
  for (const sample of barrels)
    for (const prop of sample) {
      assert.equal(prop.color, prop.actual);
      const key = `${prop.x},${prop.z}`;
      if (colors.has(key)) {
        assert.equal(colors.get(key), prop.color);
        repeated++;
      }
      colors.set(key, prop.color);
    }
  assert.ok(repeated > 10);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    `${directory}/combat-renderer.json`,
    JSON.stringify(
      { fixture: true, results, reduced, barrelComparisons: repeated, errors },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      qualities: results.map((r) => r.quality),
      barrelComparisons: repeated,
      errors,
    }),
  );
} finally {
  await browser.close();
}
