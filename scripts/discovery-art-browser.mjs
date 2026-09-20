// Controlled renderer and UI-layout fixtures; not natural gameplay.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [],
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/discovery-art-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><style>html,body,#yard{width:100%;height:100%;margin:0;overflow:hidden}</style><div id="yard"></div><script type="module">
import {YardScene} from '/src/scene.ts';import {createState} from '/src/simulation.ts';import {updateDiscovery} from '/src/discovery.ts';
const scene=new YardScene(document.querySelector('#yard'));await scene.load(()=>{});scene.setQuality('high');scene.resize();
const state=createState();state.phase='playing';state.enemies=[];state.pickups=[];state.time=10;
state.discovery.points=state.discovery.points.filter(p=>p.sector===0);
for(const p of state.discovery.points){p.x=p.kind==='chest'?0:p.kind==='repair'?-3:3;p.z=0;}
state.player.z=4;
function render(){const state=window.fixture.state;scene.render(state,0);scene.camera.position.set(3,6,11);scene.camera.lookAt(0,.65,0);scene.camera.left=-5.5;scene.camera.right=5.5;scene.camera.top=3.44;scene.camera.bottom=-3.44;scene.camera.updateProjectionMatrix();scene.renderer.render(scene.scene,scene.camera);}
window.fixture={scene,state,updateDiscovery,render,createState};render();</script>`,
    }),
  );
  await page.goto("http://127.0.0.1:5184/discovery-art-fixture");
  await page.waitForFunction(() => window.fixture);
  await page.screenshot({
    path: ".impeccable/review/discovery-models-ready.png",
  });
  const initial = await page.evaluate(() => {
    const f = window.fixture;
    return {
      lid: !!f.scene.expansion.discovery.slots[0].lid,
      loot: !!f.scene.expansion.discovery.slots[0].loot,
      geometry: f.scene.diagnostics().geometries,
    };
  });
  assert.equal(initial.lid, true);
  assert.equal(initial.loot, true);
  const animated = await page.evaluate(() => {
    const f = window.fixture,
      p = f.state.discovery.points[0];
    f.state.player = { x: p.x, z: p.z };
    f.updateDiscovery(f.state, 1.3);
    f.state.player.z = 4;
    f.state.time += 0.3;
    f.render();
    const slot = f.scene.expansion.discovery.slots[0];
    const angle = slot.lid.rotation.x;
    f.state.phase = "paused";
    for (let i = 0; i < 8; i++) f.render();
    return {
      angle,
      pausedAngle: slot.lid.rotation.x,
      loot: slot.loot.visible,
      sparks: slot.sparks.filter((s) => s.visible).length,
      receipt: f.state.discovery.lastReward,
    };
  });
  assert.ok(animated.angle < -1);
  assert.equal(animated.angle, animated.pausedAngle);
  assert.equal(animated.loot, false);
  assert.equal(animated.sparks, 6);
  assert.equal(animated.receipt.parts, 3);
  await page.screenshot({
    path: ".impeccable/review/discovery-models-open.png",
  });
  const reset = await page.evaluate(() => {
    const f = window.fixture;
    f.scene.reduced = true;
    f.render();
    const slot = f.scene.expansion.discovery.slots[0];
    const reduced = {
      angle: slot.lid.rotation.x,
      sparks: slot.sparks.filter((s) => s.visible).length,
    };
    const station = f.state.discovery.points.find((p) => p.kind === "repair");
    station.completed = true;
    station.completedAt = f.state.time;
    f.render();
    const slots = f.scene.expansion.discovery.slots;
    const repairLightsOff =
      slots[1].lights.length > 0 &&
      slots[1].lights.every((light) => light.mesh.material !== light.material);
    const salvageStillLit =
      slots[2].lights.length > 0 &&
      slots[2].lights.every((light) => light.mesh.material === light.material);
    const before = f.scene.diagnostics().geometries;
    f.state.phase = "playing";
    for (let n = 0; n < 30; n++) {
      f.state.player.x = n * 20;
      f.updateDiscovery(f.state, 0.01);
      f.render();
    }
    const after = f.scene.diagnostics().geometries;
    f.state = f.createState();
    f.state.phase = "playing";
    f.render();
    return {
      reduced,
      repairLightsOff,
      salvageStillLit,
      before,
      after,
      freshAngle: slot.lid.rotation.x,
      loot: slot.loot.visible,
    };
  });
  assert.equal(reset.repairLightsOff, true);
  assert.equal(reset.salvageStillLit, true);
  assert.equal(reset.reduced.angle, -1.8);
  assert.equal(reset.reduced.sparks, 0);
  assert.equal(reset.before, reset.after);
  assert.equal(Math.abs(reset.freshAngle), 0);
  assert.equal(reset.loot, true);
  results.push({ initial, animated, reset });
  await page.close();
  // Exercise translated receipts/previews on real HUD CSS without altering gameplay.
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [568, 320],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5184");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    // Freeze only this explicit DOM fixture, leaving real-gameplay QA untouched.
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 0;
    });
    await page.waitForTimeout(100);
    const checks = await page.evaluate(async () => {
      const { discoveryFeedback } = await import("/src/discovery-feedback.ts");
      // Use the helper's exact Vite dependency URL to share language state after HMR.
      const source = await (await fetch("/src/discovery-feedback.ts")).text();
      const i18nUrl = source.match(/from ["']([^"']*i18n[^"']*)["']/)?.[1];
      if (!i18nUrl) throw new Error("Missing localization dependency");
      const { setLanguage, t } = await import(i18nUrl);
      document.querySelector("#intro").classList.add("hidden");
      const hint = document.querySelector("#world-hint");
      let count = 0;
      for (const lang of ["tr", "en", "de", "fr", "es", "pt"]) {
        setLanguage(lang);
        for (const kind of ["chest", "repair", "salvage"])
          for (const claimed of [false, true]) {
            hint.className =
              "world-hint is-discovery" + (claimed ? " is-reward" : "");
            const reward = {
              kind,
              until: 5,
              xp: kind === "chest" ? 5 : 12,
              scrap: 0,
              hp: 8,
              parts: kind === "repair" ? 0 : kind === "chest" ? 3 : 8,
            };
            hint.innerHTML = discoveryFeedback(
              kind,
              t(
                claimed
                  ? "Claimed"
                  : kind === "salvage"
                    ? "Hold the zone"
                    : "Stay nearby to open",
              ),
              claimed ? reward : undefined,
              claimed ? undefined : 0.6,
            );
            const expectedTitle = t(
              kind === "chest"
                ? "Supply chest"
                : kind === "repair"
                  ? "Repair station"
                  : "Salvage contract",
            );
            if (hint.querySelector("strong").textContent !== expectedTitle)
              throw new Error("Localization state mismatch: " + lang);
            const r = hint.getBoundingClientRect();
            if (
              r.left < 0 ||
              r.right > innerWidth ||
              r.top < 0 ||
              r.bottom > innerHeight ||
              hint.scrollWidth > hint.clientWidth + 1
            )
              throw new Error(
                lang + " " + kind + " " + innerWidth + " overflow",
              );
            for (const child of hint.querySelectorAll("strong,small,b"))
              if (child.scrollWidth > child.clientWidth + 1)
                throw new Error(lang + " " + kind + " clipped label");
            count++;
          }
      }
      setLanguage("tr");
      hint.innerHTML = discoveryFeedback("chest", t("Claimed"), {
        kind: "chest",
        until: 5,
        xp: 5,
        scrap: 4,
        hp: 0,
        parts: 3,
      });
      return count;
    });
    assert.equal(checks, 36);
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#world-hint img")].every(
        (i) => i.complete && i.naturalWidth,
      ),
    );
    await page.screenshot({
      path: ".impeccable/review/discovery-receipt-" + width + ".png",
    });
    results.push({ width, height, layoutChecks: checks });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    ".impeccable/review/discovery-art-browser.json",
    JSON.stringify({ fixture: true, results, errors }, null, 2),
  );
  console.log(
    "PASS: GLB hinges/loot, opening animation, pause, reduced motion, streaming reset, GPU memory, 180 translated HUD layouts.",
  );
} finally {
  await browser.close();
}
