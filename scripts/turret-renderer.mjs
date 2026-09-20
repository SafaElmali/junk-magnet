// Source-renderer fixture: real simulation shots drive the turret animation.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const directory = process.env.OUTPUT_DIR ?? "/tmp/junk-magnet-turrets";
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const results = [];
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
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/turret-renderer-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#yard{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="yard"></div><script type="module">
import {YardScene} from '/src/scene.ts';
import {createState,update} from '/src/simulation.ts';
const scene=new YardScene(document.querySelector('#yard'));
await scene.load(()=>{}); scene.resize();
const state=createState();
state.phase='playing'; state.openingRemaining=0; state.pickups=[];
state.spawnTimer=Infinity; state.encounters.nextAt=Infinity; state.pulseTimer=Infinity;
state.immunity=100; state.scrap=0;
state.enemies=[{id:101,type:'can',x:3,z:3,hp:1000,hit:0,seed:0}];
state.turrets=[{id:100,x:0,z:0,life:10,rank:1,fireTimer:0}];
state.nextId=102;
window.fixture={scene,state,update};
</script>`,
      }),
    );
    await page.goto(
      `${process.env.GAME_URL ?? "http://127.0.0.1:5184"}/turret-renderer-fixture`,
    );
    await page.waitForFunction(() => window.fixture, { timeout: 30000 });
    const result = await page.evaluate(() => {
      const { scene, state, update } = window.fixture;
      update(state, 0.016, { x: 0, z: 0 });
      scene.render(state, 0.016);
      const model = scene.turretModels.get(100);
      const head = model.getObjectByName("head");
      const barrels = model.getObjectByName("barrels");
      const shot = { count: state.shots.length, recoil: barrels.position.z };
      const planted =
        model.rotation.y === 0 &&
        Math.abs(head.rotation.y - Math.PI / 4) < 0.001;
      scene.render(state, 0);
      const paused = barrels.position.z === shot.recoil;
      scene.reduced = true;
      scene.render(state, 0);
      const reduced = barrels.position.z === 0;
      scene.reduced = false;
      for (let i = 0; i < 5; i++) update(state, 0.04, { x: 0, z: 0 });
      scene.render(state, 0.2);
      const recovered = barrels.position.z === 0;
      state.enemies[0].x = -3;
      scene.render(state, 0);
      const tracks = head.rotation.y < 0 && model.rotation.y === 0;
      const heading = head.rotation.y;
      state.enemies[0].x = 30;
      scene.render(state, 0);
      const holdsOutOfRange = head.rotation.y === heading;
      state.enemies = [];
      scene.render(state, 0);
      const holdsWithoutTarget = head.rotation.y === heading;
      state.turrets[0].life = 0.5;
      scene.render(state, 0);
      const expires = model.scale.x === 0.5;
      state.turrets = [];
      scene.render(state, 0);
      const removed = scene.turretModels.size === 0 && model.parent === null;
      let meshes = 0;
      scene.turretTemplate.traverse((o) => {
        if (o.isMesh) meshes++;
      });
      const qualities = [];
      let stableGeometry = true;
      for (const quality of ["performance", "balanced", "high", "ultra"]) {
        scene.setQuality(quality);
        let geometries;
        for (let cycle = 0; cycle < 3; cycle++) {
          scene.clear();
          state.turrets = Array.from({ length: 6 }, (_, i) => ({
            id: 200 + cycle * 6 + i,
            x: ((i % 3) - 1) * 2.2,
            z: Math.floor(i / 3) * 2.5 - 1,
            life: 10,
            rank: 1,
            fireTimer: 0.4,
          }));
          scene.render(state, 0);
          const current = scene.diagnostics().geometries;
          if (cycle > 0) stableGeometry &&= current === geometries;
          geometries = current;
        }
        qualities.push({ quality, count: scene.turretModels.size });
      }
      const instances = [...scene.turretModels.values()];
      const shared =
        instances[0].getObjectByName("chassis").children[0].geometry ===
        instances[1].getObjectByName("chassis").children[0].geometry;
      scene.setQuality("high");
      state.shots = [];
      state.player.x = 0;
      state.player.z = 4;
      scene.render(state, 0);
      return {
        shot,
        planted,
        paused,
        reduced,
        recovered,
        tracks,
        holdsOutOfRange,
        holdsWithoutTarget,
        expires,
        removed,
        meshes,
        qualities,
        stableGeometry,
        shared,
      };
    });
    assert.equal(result.shot.count, 1);
    assert.ok(result.shot.recoil < 0);
    for (const key of [
      "planted",
      "paused",
      "reduced",
      "recovered",
      "tracks",
      "holdsOutOfRange",
      "holdsWithoutTarget",
      "expires",
      "removed",
      "stableGeometry",
      "shared",
    ])
      assert.equal(result[key], true, `${key} at ${width}px`);
    assert.ok(result.meshes <= 13);
    assert.ok(result.qualities.every((q) => q.count === 6));
    await page.screenshot({
      path: `${directory}/turrets-gameplay-${width}.png`,
    });
    if (width === 1440) {
      await page.evaluate(() => {
        const { scene, state } = window.fixture;
        state.turrets = [
          { id: 301, x: -1.45, z: 0, life: 10, rank: 1, fireTimer: 0.4 },
          { id: 302, x: 1.45, z: 0, life: 10, rank: 1, fireTimer: 0.4 },
        ];
        scene.render(state, 0);
        scene.turretModels.get(301).getObjectByName("head").rotation.y = -0.4;
        scene.turretModels.get(302).getObjectByName("head").rotation.y = 2.8;
        for (const child of scene.scene.children)
          if (
            child !== scene.floor &&
            !child.isLight &&
            ![...scene.turretModels.values()].includes(child)
          )
            child.visible = false;
        scene.camera.position.set(2.5, 5.5, 8);
        scene.camera.lookAt(0, 0.5, 0);
        scene.camera.zoom = 4;
        scene.camera.updateProjectionMatrix();
        scene.renderer.render(scene.scene, scene.camera);
      });
      await page.screenshot({ path: `${directory}/turrets-detail.png` });
    }
    results.push({ width, ...result });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    `${directory}/turrets.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, results, errors }));
} finally {
  await browser.close();
}
