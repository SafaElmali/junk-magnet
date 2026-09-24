// MAGNA, the fourth robot, everywhere a robot appears. Part 1 is an isolated
// renderer fixture that drives the real model's rig (not natural gameplay).
// Part 2 plays the real game with MAGNA chosen through saved progress: the pilot
// card, the Workshop carousel, the in-run model and the result screen, at five
// layouts in English and German. Save-game fixtures seed parts; they do not
// claim the parts were earned in a browser run.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5184/play/";
const origin = new URL(url).origin;
const shots =
  process.env.SHOT_DIR ??
  (await fs.mkdtemp(path.join(os.tmpdir(), "junk-magnet-robot-")));
const SAVE = "junk-magnet-workshop-v1";
const progress = (patch) => ({
  version: 1,
  parts: 40,
  selectedRobot: "magna",
  unlockedRobots: ["scrap", "magna"],
  upgrades: { hull: 0, magnet: 0 },
  bestTime: 125,
  bestKills: 72,
  completedRuns: 3,
  recentRunIds: [],
  ...patch,
});
const report = { url, shots, rig: {}, checks: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  // 1. Rig fixture: wheels of two sizes, both belts, suspension and hurt tint.
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/robot-rig-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#yard{margin:0;width:100%;height:100%;overflow:hidden}aside{position:fixed;left:12px;top:12px;padding:8px 12px;background:#142f37;color:#fff4d8;font:12px sans-serif;border:1px solid #e7b64d}</style><div id="yard"></div><aside>ISOLATED RENDERER FIXTURE · MAGNA RIG</aside><script type="module">
import {YardScene} from '/src/scene.ts';
import {createState,update} from '/src/simulation.ts';
import {DEFAULT_RUN_CONFIG,ROBOTS} from '/src/progression.ts';
const scene=new YardScene(document.querySelector('#yard'));await scene.load(()=>{});scene.setQuality('high');scene.resize();
function prepare(robotId){const r=ROBOTS.find(x=>x.id===robotId);const s=createState({...DEFAULT_RUN_CONFIG,robotId,startingWeapon:r.startingWeapon,speedMultiplier:r.speedMultiplier,damageReduction:r.damageReduction});
s.phase='playing';s.openingRemaining=0;s.enemies=[];s.pickups=[];s.spawnTimer=Infinity;s.encounters.nextAt=Infinity;s.pulseTimer=Infinity;s.abilityTimers.burst=Infinity;s.immunity=100;return s;}
function drive(s,frames,move){for(let i=0;i<frames;i++){update(s,.05,move);scene.events(s.events.splice(0),s);scene.render(s,.05);}}
function calls(robotId){scene.clear();const s=prepare(robotId);drive(s,2,{x:0,z:0});return scene.renderer.info.render.calls;}
window.fixture={scene,prepare,drive,calls};</script>`,
      }),
    );
    await page.goto(`${origin}/robot-rig-fixture`);
    await page.waitForFunction(() => window.fixture, null, { timeout: 30000 });
    const rig = await page.evaluate(() => {
      const f = window.fixture;
      const s = f.prepare("magna");
      f.drive(s, 1, { x: 0, z: 0 });
      const rig = f.scene.robotRigs.get("magna");
      const angles = () => rig.wheels.map((w) => w.angle);
      const offsets = () => rig.belts.map((b) => b.offset);
      const visible = Object.fromEntries(
        [...f.scene.robotModels].map(([id, model]) => [id, model.visible]),
      );
      // Instance scales of the first wheel batch (column length of each matrix).
      const batch = rig.wheelBatches[0];
      const scales = Array.from({ length: batch.count }, (_, i) => {
        const m = batch.instanceMatrix.array;
        return Math.hypot(m[i * 16], m[i * 16 + 1], m[i * 16 + 2]);
      });
      const a0 = angles(),
        o0 = offsets();
      // Pull away: the belts and wheels roll and the body rocks back.
      f.drive(s, 4, { x: 0, z: 1 });
      const pitch = rig.pitch;
      f.drive(s, 16, { x: 0, z: 1 });
      const a1 = angles(),
        o1 = offsets();
      // Pivot on the spot: face the other way without moving.
      s.facing = { x: 0, z: -1 };
      const o2 = offsets();
      f.drive(s, 3, { x: 0, z: 0 });
      const o3 = offsets();
      document.querySelector("aside").textContent += " · driven";
      return {
        visible,
        wheels: rig.wheels.map((w) => ({ radius: w.radius, left: w.left, scale: w.scale.x })),
        instanceScales: scales,
        links: rig.belts.map((b) => b.links.length),
        rolled: a1.map((a, i) => a - a0[i]),
        beltTravel: o1.map((o, i) => o - o0[i]),
        pivot: o3.map((o, i) => o - o2[i]),
        pitch,
        bodyTilt: f.scene.robot.getObjectByName("body")?.rotation.x ?? null,
        calls: Object.fromEntries(["scrap", "scout", "volt", "magna"].map((id) => [id, f.calls(id)])),
      };
    });
    assert.deepEqual(rig.visible, { scrap: false, scout: false, volt: false, magna: true });
    assert.equal(rig.wheels.length, 6, "three wheels per side");
    assert.deepEqual(rig.links, [rig.links[0], rig.links[0]]);
    assert.ok(rig.links[0] >= 28, `${rig.links[0]} links per belt`);
    const radii = [...new Set(rig.wheels.map((w) => w.radius.toFixed(3)))].map(Number).sort();
    assert.equal(radii.length, 2, "idlers and road wheels differ in size");
    assert.ok(rig.instanceScales.some((scale) => Math.abs(scale - 1.2) < 0.01), "idlers draw at their size");
    for (let i = 0; i < rig.wheels.length; i++) {
      assert.ok(Math.abs(rig.rolled[i]) > 0.5, `wheel ${i} rolls`);
      // Every wheel covers the same ground, so smaller wheels turn further.
      assert.ok(
        Math.abs(rig.rolled[i] * rig.wheels[i].radius - rig.rolled[0] * rig.wheels[0].radius) < 1e-6,
        `wheel ${i} rolls at its own radius`,
      );
    }
    assert.ok(rig.beltTravel.every((t) => t > 1), "both belts run forward");
    assert.ok(rig.pivot[0] * rig.pivot[1] < 0, "a pivot turn runs the belts in opposite directions");
    assert.ok(Math.abs(rig.pitch) > 0.005, "the body rocks when pulling away");
    // No more draw calls than the existing detailed variants.
    assert.ok(
      rig.calls.magna <= Math.max(rig.calls.scout, rig.calls.volt),
      `draw calls ${JSON.stringify(rig.calls)}`,
    );
    await page.screenshot({ path: path.join(shots, `magna-rig-fixture-${width}.png`) });
    // Damage feedback tints MAGNA's own enamel and restores it.
    const tint = await page.evaluate(() => {
      const f = window.fixture;
      const s = f.prepare("magna");
      f.drive(s, 1, { x: 0, z: 0 });
      const enamel = () => {
        let hex;
        f.scene.robotModels.get("magna").traverse((o) => {
          if (o.isMesh && o.material.name === "Magna cobalt enamel") hex = o.material.color.getHexString();
        });
        return hex;
      };
      const before = enamel();
      f.scene.events([{ kind: "hurt", x: s.player.x, z: s.player.z }], s);
      f.drive(s, 2, { x: 0, z: 0 });
      const hurt = enamel();
      f.drive(s, 30, { x: 0, z: 0 });
      return { before, hurt, after: enamel() };
    });
    assert.ok(tint.before, "MAGNA has its own enamel material");
    assert.notEqual(tint.hurt, tint.before);
    assert.equal(tint.after, tint.before);
    assert.deepEqual(errors, []);
    report.rig[width] = { ...rig, tint };
    await page.close();
  }
  report.checks.push("rig fixture: 2 wheel sizes, belts, pivot turn, suspension, hurt tint");

  // 2. The real game with MAGNA selected through saved progress.
  const overflow = (page, selector) =>
    page.evaluate(
      (selector) =>
        [...document.querySelectorAll(selector)]
          .filter((e) => e.getClientRects().length)
          .flatMap((e) => {
            const r = e.getBoundingClientRect();
            return e.scrollHeight > e.clientHeight + 2 ||
              e.scrollWidth > e.clientWidth + 2 ||
              r.top < -1 ||
              r.left < -1 ||
              r.bottom > innerHeight + 1 ||
              r.right > innerWidth + 1
              ? [`${e.id || e.className}`]
              : [];
          }),
      selector,
    );
  const images = (page, selector) =>
    page.waitForFunction(
      (selector) =>
        [...document.querySelectorAll(selector)]
          .filter((img) => img.getClientRects().length)
          .every((img) => img.complete && img.naturalWidth > 0),
      selector,
    );
  const read = (page) => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  const open = async (options, save) => {
    const context = await browser.newContext(options);
    await context.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("seeded", "1");
        }
      },
      [SAVE, JSON.stringify(save)],
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__, null, { timeout: 30000 });
    return { context, page, errors };
  };
  const copy = {
    en: {
      weapon: "Magnetic Burst",
      description: "Heavy magnet unit. +2 armor, +0.4 m pickup range, −8% speed.",
      selected: "Selected",
    },
    de: {
      weapon: "Magnetstoß",
      description: "Schwere Magneteinheit. +2 Panzerung, +0,4 m Sammelradius, −8 % Tempo.",
      selected: "Ausgewählt",
    },
  };
  for (const locale of ["en-US", "de-DE"])
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 568],
      [844, 390],
      [568, 320],
    ]) {
      const lang = locale.slice(0, 2);
      const tag = `${lang}-${width}x${height}`;
      const { context, page, errors } = await open(
        { viewport: { width, height }, locale, hasTouch: width < 900, isMobile: width < 900 },
        progress(),
      );
      // Pilot card (compact layouts show only the portrait, or hide the card).
      assert.equal(await page.locator("#menu-pilot-name").textContent(), "MAGNA");
      assert.equal(await page.locator("#menu-weapon").textContent(), copy[lang].weapon);
      assert.equal(await page.locator("#menu-pilot-copy").textContent(), copy[lang].description);
      assert.ok(
        (await page.locator(".pilot-art img").getAttribute("src")).endsWith("/robots/magna.png"),
      );
      await images(page, "#intro img");
      assert.deepEqual(
        await overflow(page, ".pilot-card, .pilot-card h3, .pilot-card p, .pilot-weapon, #menu-robots"),
        [],
        `${tag} pilot card`,
      );
      await page.waitForTimeout(700); // Menu entry animation.
      await page.screenshot({ path: path.join(shots, `magna-menu-${tag}.png`) });
      // Workshop carousel, from the pilot card's Change Robot control where
      // the layout shows it (compact home screens hide the card).
      if (await page.locator("#menu-robots").isVisible()) await page.locator("#menu-robots").click();
      else {
        await page.locator("#menu-workshop").click();
        await page.locator('[data-workshop-tab="robots"]').click();
      }
      const kicker = page.locator("#menu-workshop-content .workshop-kicker");
      assert.match(await kicker.textContent(), /^4 \/ 4 · /);
      assert.equal(await page.locator("#menu-workshop-content h4").textContent(), "MAGNA");
      assert.equal(await page.locator("[data-robot-action]").textContent(), copy[lang].selected);
      assert.equal(await page.locator("[data-robot-action]").isDisabled(), true);
      await page.waitForFunction(() => {
        const img = document.querySelector("#menu-workshop-content img.workshop-robot");
        return img?.complete && img.naturalWidth === 768 && img.src.endsWith("/robots/magna.png");
      });
      assert.deepEqual(
        await overflow(
          page,
          ".menu-shell,.menu-panel,#menu-workshop-content,.workshop-machine,.workshop-machine-copy,.workshop-machine-copy *,.workshop-portrait",
        ),
        [],
        `${tag} workshop`,
      );
      await page.screenshot({ path: path.join(shots, `magna-workshop-${tag}.png`) });
      // The carousel wraps from MAGNA to SCRAP-01 and back.
      await page.locator('[data-robot-step="1"]').click();
      assert.equal(await page.locator("#menu-workshop-content h4").textContent(), "SCRAP-01");
      await page.locator('[data-robot-step="-1"]').click();
      assert.equal(await page.locator("#menu-workshop-content h4").textContent(), "MAGNA");
      await page.locator("#menu-back").click();
      // In the run: MAGNA's model, heavy config and starting burst.
      await page.locator("#start").click();
      await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().time > 0.3);
      const run = await read(page);
      assert.equal(run.robot.robotId, "magna");
      assert.equal(run.robot.damageReduction, 2);
      assert.equal(run.robot.speedMultiplier, 0.92);
      assert.equal(run.upgrades.burst, 1);
      assert.equal(run.upgrades.saw, 0);
      await page.keyboard.down("KeyA");
      await page.waitForTimeout(600);
      await page.keyboard.up("KeyA");
      await page.screenshot({ path: path.join(shots, `magna-run-${tag}.png`) });
      assert.deepEqual(errors, []);
      await context.close();
      report.checks.push(`pilot card, workshop and run ${tag}`);
    }

  // 3. Locked MAGNA shows progress, then unlocks at 160 parts.
  {
    const { context, page, errors } = await open(
      { viewport: { width: 1440, height: 900 }, locale: "en-US" },
      progress({ parts: 100, selectedRobot: "scrap", unlockedRobots: ["scrap"] }),
    );
    await page.locator("#menu-workshop").click();
    await page.locator('[data-robot-step="-1"]').click();
    assert.equal(await page.locator("#menu-workshop-content h4").textContent(), "MAGNA");
    assert.match(await page.locator(".workshop-kicker").textContent(), /Locked/);
    assert.equal(await page.locator(".workshop-progress").getAttribute("aria-valuemax"), "160");
    assert.equal(await page.locator("[data-robot-action]").textContent(), "Unlock · 160 parts");
    assert.equal(await page.locator("[data-robot-action]").isDisabled(), true);
    await page.waitForFunction(() => {
      const img = document.querySelector("#menu-workshop-content img.workshop-robot");
      return img?.complete && img.naturalWidth === 768 && img.src.endsWith("/robots/magna.png");
    });
    await page.evaluate(() => document.querySelector("#menu-workshop-content img.workshop-robot").decode());
    await page.screenshot({ path: path.join(shots, "magna-workshop-locked-1440.png") });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page, errors } = await open(
      { viewport: { width: 1440, height: 900 }, locale: "en-US" },
      progress({ parts: 160, selectedRobot: "scrap", unlockedRobots: ["scrap"] }),
    );
    await page.locator("#menu-workshop").click();
    await page.locator('[data-robot-step="-1"]').click();
    await page.locator('[data-robot-action="unlock"]').click();
    await page.locator('[data-robot-action="select"]').click();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE);
    assert.equal(saved.parts, 0);
    assert.equal(saved.selectedRobot, "magna");
    assert.deepEqual(saved.unlockedRobots, ["scrap", "magna"]);
    assert.deepEqual(errors, []);
    await context.close();
  }
  report.checks.push("locked MAGNA progress, 160-part unlock and selection");

  // 4. The result screen names MAGNA after a real defeat.
  for (const [locale, width, height] of [
    ["en-US", 1440, 900],
    ["de-DE", 390, 844],
  ]) {
    const { context, page, errors } = await open(
      { viewport: { width, height }, locale, hasTouch: width < 900, isMobile: width < 900 },
      progress(),
    );
    await page.locator("#start").click();
    for (let i = 0; i < 2000; i++) {
      const s = await read(page);
      if (s.phase === "lost") break;
      if (s.phase === "upgrade") {
        await page.waitForTimeout(300);
        await page.locator('.upgrade-choice:not([data-upgrade="repair"])').first().click();
        continue;
      }
      const e = s.enemies.sort(
        (a, b) =>
          Math.hypot(a.x - s.player.x, a.z - s.player.z) -
          Math.hypot(b.x - s.player.x, b.z - s.player.z),
      )[0];
      const keys = e
        ? [
            ...(Math.abs(e.x - s.player.x) > 0.12 ? [e.x > s.player.x ? "KeyD" : "KeyA"] : []),
            ...(Math.abs(e.z - s.player.z) > 0.12 ? [e.z > s.player.z ? "KeyS" : "KeyW"] : []),
          ]
        : [];
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(65);
      for (const k of keys) await page.keyboard.up(k);
    }
    const lost = await read(page);
    assert.equal(lost.phase, "lost");
    await page.locator("#result").waitFor({ state: "visible" });
    assert.equal(await page.locator(".result-unit").textContent(), "MAGNA");
    assert.deepEqual(
      await overflow(page, "#result .modal-card, .result-heading, .result-unit"),
      [],
      `${locale} ${width}x${height} result`,
    );
    await page.screenshot({ path: path.join(shots, `magna-result-${locale.slice(0, 2)}-${width}x${height}.png`) });
    assert.deepEqual(errors, []);
    await context.close();
    report.checks.push(`result screen ${locale} ${width}x${height} after ${lost.time.toFixed(0)} s`);
  }
  report.pass = true;
} finally {
  await browser.close();
  await fs.writeFile(path.join(shots, "robot-browser.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass ?? false, shots, checks: report.checks, rig: report.rig[1440] }, null, 2));
}
