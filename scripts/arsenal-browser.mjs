// Arsenal check. Part 1 is an isolated real-source renderer fixture: actual update() calls
// fire the harpoon, mortar and evolutions, and real spawn() rolls the elites; enemies are
// then placed on screen. Part 2 renders the production level-up, specialization, loadout,
// build inspector and recipe markup in the live game page with separate sample states.
// GAME_URL=http://127.0.0.1:5301/play/ OUTPUT_DIR=/tmp/arsenal node scripts/arsenal-browser.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const gameUrl = process.env.GAME_URL ?? "http://127.0.0.1:5184/play/";
const origin = new URL(gameUrl).origin;
const directory = process.env.OUTPUT_DIR ?? (await fs.mkdtemp(path.join(os.tmpdir(), "junk-magnet-arsenal-")));
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const report = { renderer: [], ui: [] };
const fixture = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#yard{margin:0;width:100%;height:100%;overflow:hidden}aside{position:fixed;left:12px;top:12px;padding:6px 10px;background:#142f37;color:#fff4d8;font:12px sans-serif;border:1px solid #e7b64d;pointer-events:none}</style><div id="yard"></div><aside>ARSENAL RENDERER FIXTURE · <span id="stage"></span></aside><script type="module">
import {YardScene} from '/src/scene.ts';
import {createState,update} from '/src/simulation.ts';
import {DEFAULT_RUN_CONFIG,NO_MODIFIERS} from '/src/progression.ts';
const scene=new YardScene(document.querySelector('#yard'));await scene.load(()=>{});scene.setQuality(innerWidth<500?'performance':'high');scene.resize();
function prepare(config={}){
  const s=createState({...DEFAULT_RUN_CONFIG,...config});
  s.phase='playing';s.openingRemaining=0;s.enemies=[];s.pickups=[];s.spawnTimer=Infinity;s.encounters.nextAt=Infinity;s.pulseTimer=Infinity;s.immunity=1e9;s.upgrades.saw=0;
  return s;
}
function add(s,type,x,z,hp=1e6,elite=false){const e={id:s.nextId++,type,x,z,hp,hit:0,seed:x*3+z,elite};s.enemies.push(e);return e;}
function step(s,frames,world=false){for(let i=0;i<frames;i++){update(s,0.05,{x:0,z:0},{world,deferDiscovery:true,deferUpgrade:true});scene.events(s.events.splice(0),s);scene.render(s,s.phase==='playing'?0.05:0);}}
function label(text){document.querySelector('#stage').textContent=text;}
// Portrait phones see less width, so throws and groups run vertically there.
const portrait=innerWidth<500, dir=portrait?{x:.3,z:-.95}:{x:.92,z:-.39};
const along=(d,side=0)=>({x:dir.x*d-dir.z*side,z:dir.z*d+dir.x*side});
window.fixture={scene,prepare,add,step,label,update,NO_MODIFIERS,portrait,dir,along};
</script>`;
try {
  // ---------- Part 1: renderer fixture ----------
  for (const [width, height, reduced] of [
    [1440, 900, false],
    [390, 844, false],
    [390, 844, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 500,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    page.on("pageerror", (e) => errors.push(`${width} ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${width} ${m.text()}`));
    await page.route("**/arsenal-fixture", (route) => route.fulfill({ contentType: "text/html", body: fixture }));
    await page.goto(`${origin}/arsenal-fixture`);
    await page.waitForFunction(() => window.fixture, { timeout: 60000 });
    const suffix = `${width}${reduced ? "-reduced" : ""}`;
    const shot = (name) => page.screenshot({ path: `${directory}/${name}-${suffix}.png` });

    const harpoon = await page.evaluate(() => {
      const { scene, prepare, add, step, label, dir, along } = window.fixture;
      scene.clear();
      const s = prepare();
      s.upgrades.harpoon = 5;
      s.facing = { ...dir };
      const cans = Array.from({ length: 8 }, (_, i) => {
        const p = along(2.2 + i * 0.8, ((i % 3) - 1) * 0.45);
        return add(s, "can", p.x, p.z);
      });
      step(s, 5);
      label("MAGNET HARPOON · RANK 5");
      window.fixture.state = s;
      return { hooks: s.arsenal.harpoons.length, drawn: scene.diagnostics().attackFx.arsenal.hooks, hit: cans.filter((e) => e.hp < 1e6).length };
    });
    assert.equal(harpoon.hooks, 3);
    assert.equal(harpoon.drawn, harpoon.hooks);
    assert.ok(harpoon.hit >= 3, "hooks pierce several enemies");
    await shot("harpoon");

    const frozen = await page.evaluate(() => {
      const { scene, update } = window.fixture, s = window.fixture.state;
      const matrices = () => JSON.stringify(Array.from(scene.arsenal.hooks.instanceMatrix.array.slice(0, 48)));
      s.phase = "paused";
      const before = JSON.stringify(s), hooks = matrices();
      for (let i = 0; i < 6; i++) {
        update(s, 0.05, { x: 1, z: 0 });
        scene.render(s, 0);
      }
      return { state: before === JSON.stringify(s), hooks: hooks === matrices() };
    });
    assert.deepEqual(frozen, { state: true, hooks: true }, "pause freezes hooks");

    const winch = await page.evaluate(() => {
      const { scene, prepare, add, step, label, dir, along } = window.fixture;
      scene.clear();
      const s = prepare();
      Object.assign(s.upgrades, { harpoon: 5, magnet: 2 });
      s.evolutions.winch = true;
      s.facing = { ...dir };
      const far = [along(8.6, 0.1), along(9.2, -0.3)].map((p, i) => add(s, i ? "runner" : "can", p.x, p.z));
      for (let i = 0; i < 5; i++) s.pickups.push({ id: s.nextId++, ...along(6 + i * 0.5, 0.15), kind: i % 2 ? "xp" : "scrap", born: -1 });
      step(s, 13);
      label("SCRAP WINCH · REELING");
      return {
        hooks: s.arsenal.harpoons.length,
        dragged: far.filter((e) => Math.hypot(e.x - s.player.x, e.z - s.player.z) < 7).length,
        carried: s.arsenal.harpoons.reduce((n, h) => n + h.loot.length, 0),
      };
    });
    assert.equal(winch.hooks, 5);
    assert.ok(winch.dragged >= 1, "struck enemies are dragged back");
    assert.ok(winch.carried >= 1, "pickups ride the hooks");
    await shot("scrap-winch");

    const slag = await page.evaluate(() => {
      const { scene, prepare, add, step, label } = window.fixture;
      scene.clear();
      const s = prepare();
      s.upgrades.slag = 5;
      s.specializations.slag = "slag_cluster";
      // Three separate groups, one per cluster shell.
      for (const [type, x, z, n] of [["can", 2.6, -3.4, 9], ["runner", -3, 1.6, 6], ["brute", 1.2, 4.6, 4]])
        for (let i = 0; i < n; i++) add(s, type, x + (i % 3) * 0.55, z + Math.floor(i / 3) * 0.55);
      step(s, 6);
      const flight = { shells: s.arsenal.shells.length, drawn: scene.diagnostics().attackFx.arsenal.shells };
      step(s, 10);
      label("SLAG MORTAR · CLUSTER SHELLS");
      return { flight, puddles: s.arsenal.puddles.length, drawn: scene.diagnostics().attackFx.arsenal.puddles, burnt: s.enemies.filter((e) => e.hp < 1e6).length };
    });
    assert.equal(slag.flight.shells, 3);
    assert.equal(slag.flight.drawn, 3);
    assert.equal(slag.puddles, 3);
    assert.equal(slag.drawn, slag.puddles);
    assert.ok(slag.burnt >= 6);
    await shot("slag-mortar");

    const meltdown = await page.evaluate(() => {
      const { scene, prepare, add, step, label } = window.fixture;
      scene.clear();
      const s = prepare();
      Object.assign(s.upgrades, { slag: 5, amplifier: 2 });
      s.evolutions.meltdown = true;
      for (let i = 0; i < 12; i++) add(s, "can", 2.4 + (i % 4) * 0.6, -2.5 + Math.floor(i / 4) * 0.6, 6);
      step(s, 30);
      label("MELTDOWN · CHAIN PUDDLES");
      return { kills: s.kills, puddles: s.arsenal.puddles.length, drawn: scene.diagnostics().attackFx.arsenal.puddles };
    });
    assert.ok(meltdown.kills >= 6);
    assert.ok(meltdown.puddles > 3, "kills in slag leave new puddles");
    assert.ok(meltdown.puddles <= 14);
    assert.equal(meltdown.drawn, meltdown.puddles);
    await shot("meltdown");

    const reactor = await page.evaluate(() => {
      const { scene, prepare, step, label } = window.fixture;
      scene.clear();
      const s = prepare();
      Object.assign(s.upgrades, { burst: 5, capacitor: 2 });
      s.evolutions.reactor = true;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        s.pickups.push({ id: s.nextId++, x: Math.cos(a) * 7.5, z: Math.sin(a) * 7.5, kind: "xp", born: -1 });
      }
      const before = s.pickups.reduce((n, p) => n + Math.hypot(p.x, p.z), 0);
      step(s, 11);
      label("PULSE REACTOR · ECHO AND SWEEP");
      return { pulled: before - s.pickups.reduce((n, p) => n + Math.hypot(p.x - s.player.x, p.z - s.player.z), 0), xp: s.xp };
    });
    assert.ok(reactor.xp > 0 || reactor.pulled > 20, "the sweep pulls pickups in");
    await shot("pulse-reactor");

    const elites = await page.evaluate(() => {
      const { scene, prepare, add, step, label, update, NO_MODIFIERS, portrait } = window.fixture;
      scene.clear();
      // Real spawn() rolls with a forced elite chance; positions are then moved on screen.
      const s = prepare({ modifiers: { ...NO_MODIFIERS, eliteChance: 1 } });
      s.time = 800;
      for (let i = 0; i < 3; i++) {
        s.spawnTimer = 0;
        update(s, 0.001, { x: 0, z: 0 }, { deferDiscovery: true, deferUpgrade: true });
      }
      s.spawnTimer = Infinity;
      const spawned = s.enemies.length, allElite = s.enemies.every((e) => e.elite);
      const spread = portrait ? 0.72 : 1;
      s.enemies.forEach((e, i) => {
        const a = (i / s.enemies.length) * Math.PI * 2;
        e.x = Math.cos(a) * (3.2 + (i % 2) * 2) * spread;
        e.z = Math.sin(a) * (3.2 + (i % 2) * 2) * 0.85;
      });
      const plain = portrait
        ? [["can", -2.8, 7.2], ["runner", -0.9, 7.6], ["brute", 1.8, 7.2], ["charger", 2.4, -7.4]]
        : [["can", -7.4, 4.5], ["runner", -6, 5.2], ["brute", 7.4, 4.5], ["charger", 6.4, -5.2]];
      for (const [type, x, z] of plain) add(s, type, x, z);
      step(s, 1);
      label("ELITES (GOLD HALO) BESIDE ORDINARY ENEMIES");
      const halo = () => Array.from(scene.arsenal.halos.instanceMatrix.array.slice(0, 16));
      const first = halo();
      s.time += 0.37;
      scene.render(s, 0);
      const moved = JSON.stringify(first) !== JSON.stringify(halo());
      return { spawned, allElite, elites: s.enemies.filter((e) => e.elite).length, drawn: scene.diagnostics().attackFx.arsenal.elites, haloPulses: moved, reduced: scene.reduced };
    });
    assert.ok(elites.spawned >= 12);
    assert.equal(elites.allElite, true);
    assert.equal(elites.drawn, elites.elites);
    assert.equal(elites.haloPulses, !reduced, "reduced motion holds the halo still");
    await shot("elites");

    const presets = await page.evaluate(() => {
      const { scene, prepare, add, step } = window.fixture;
      const out = [];
      for (const quality of ["performance", "balanced", "high", "ultra"]) {
        scene.setQuality(quality);
        let geometries;
        let stable = true;
        for (let cycle = 0; cycle < 3; cycle++) {
          scene.clear();
          const s = prepare();
          Object.assign(s.upgrades, { harpoon: 5, slag: 5 });
          for (let i = 0; i < 8; i++) add(s, "can", 3 + i * 0.4, -2 + (i % 3), 1e6, i % 2 === 0);
          step(s, 20);
          const g = scene.diagnostics().geometries;
          if (cycle) stable &&= g === geometries;
          geometries = g;
        }
        out.push({ quality, stable, arsenal: scene.diagnostics().attackFx.arsenal });
      }
      scene.clear();
      return { out, cleared: scene.diagnostics().attackFx.arsenal };
    });
    for (const p of presets.out) {
      assert.equal(p.stable, true, `${p.quality} geometry stays bounded`);
      assert.ok(p.arsenal.elites === 4 && p.arsenal.puddles > 0, `${p.quality} draws elites and puddles`);
    }
    assert.deepEqual(presets.cleared, { hooks: 0, shells: 0, puddles: 0, elites: 0 });
    report.renderer.push({ width, height, reduced, harpoon, frozen, winch, slag, meltdown, reactor, elites, presets });
    await page.close();
  }

  // ---------- Part 2: production markup in the live game page ----------
  for (const locale of ["en-US", "de-DE"]) {
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390], [568, 320]]) {
      const mobile = width < 900;
      const page = await browser.newPage({ viewport: { width, height }, locale, isMobile: mobile, hasTouch: mobile });
      page.on("pageerror", (e) => errors.push(`${locale} ${width} ${e.message}`));
      await page.goto(gameUrl);
      await page.waitForFunction(() => window.__JUNK_MAGNET__);
      await page.evaluate(() => document.fonts.ready);
      const tag = `${locale.slice(0, 2)}-${width}x${height}`;
      // Evolution recipes: real menu navigation and pagination.
      await page.locator("#menu-abilities").click();
      await page.locator("#menu-evolutions-open").click();
      const recipes = [];
      for (let sheet = 0; ; sheet++) {
        await page.waitForFunction(() => [...document.querySelectorAll("#menu-evolutions img")].every((i) => i.complete && i.naturalWidth > 0));
        recipes.push(
          await page.evaluate(() => {
            const intro = document.querySelector("#intro"), panel = document.querySelector("#menu-panel");
            return {
              names: [...document.querySelectorAll(".evolution-recipe h4")].map((h) => h.textContent),
              fits: panel.scrollHeight <= panel.clientHeight + 1 && intro.scrollHeight <= intro.clientHeight + 1 && intro.scrollWidth <= intro.clientWidth,
            };
          }),
        );
        await page.screenshot({ path: `${directory}/recipes-${tag}-${sheet + 1}.png` });
        const next = page.locator('[data-evolution-page="next"]:not([disabled])');
        if (!(await next.count())) break;
        await next.click();
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.evolutionPage !== undefined), true, "focus stays on pagination");
      }
      assert.ok(recipes.every((r) => r.fits), `${tag} recipes fit without scrolling`);
      const names = recipes.flatMap((r) => r.names);
      assert.equal(names.length, 6);
      assert.equal(new Set(names).size, 6);
      if (locale === "en-US") for (const name of ["Pulse Reactor", "Meltdown", "Scrap Winch"]) assert.ok(names.includes(name), name);
      else for (const name of ["Pulsreaktor", "Kernschmelze", "Schrottwinde"]) assert.ok(names.includes(name), name);
      await page.keyboard.press("Escape");

      // Level-up and specialization cards for the new abilities, laid out like production.
      const cards = await page.evaluate(async () => {
        const { createState } = await import("/src/simulation.ts");
        const { upgradeChoicesMarkup } = await import("/src/level-up.ts");
        const { specializationHeading } = await import("/src/specialization-ui.ts");
        document.querySelector("#intro").classList.add("hidden");
        document.querySelector("#app").classList.replace("in-menu", "in-run");
        document.querySelector("#upgrade").classList.remove("hidden");
        const issues = [];
        for (const [choices, ranks, branches] of [
          [["harpoon", "slag", "capacitor"], {}, []],
          [["amplifier", "harpoon", "slag"], { harpoon: 4, slag: 4, amplifier: 3 }, []],
          [["capacitor", "amplifier", "slag"], { capacitor: 2, slag: 1 }, []],
          [[], {}, ["harpoon_volley", "harpoon_anchor"]],
          [[], {}, ["slag_cluster", "slag_pool"]],
        ]) {
          const s = createState();
          s.level = 25;
          Object.assign(s.upgrades, ranks);
          s.choices = choices;
          s.specializationChoices = branches;
          if (branches.length) [document.querySelector("#upgrade-title").textContent, document.querySelector("#upgrade-copy").textContent] = specializationHeading();
          document.querySelector("#upgrade-choices").innerHTML = upgradeChoicesMarkup(s);
          await Promise.all([...document.querySelectorAll("#upgrade img")].map((img) => img.decode().catch(() => {})));
          const panel = document.querySelector(".upgrade-sheet"), r = panel.getBoundingClientRect();
          if (panel.scrollHeight > panel.clientHeight + 1 || panel.scrollWidth > panel.clientWidth + 1) issues.push(`${choices}${branches} panel overflow`);
          for (const el of document.querySelectorAll("#upgrade button,#upgrade .upgrade-description,#upgrade .upgrade-name-row,#upgrade img,#upgrade-title,#upgrade-copy")) {
            const b = el.getBoundingClientRect();
            if (b.x < r.x - 1 || b.right > r.right + 1 || b.y < r.y - 1 || b.bottom > r.bottom + 1 || b.bottom > innerHeight) issues.push(`${choices}${branches} ${el.className || el.id} clipped`);
            if (el.scrollWidth > el.clientWidth + 1) issues.push(`${choices}${branches} ${el.className || el.id} overflow`);
          }
        }
        return issues;
      });
      assert.deepEqual(cards, [], `${tag} level-up cards`);
      await page.evaluate(async () => {
        const { createState } = await import("/src/simulation.ts");
        const { upgradeChoicesMarkup } = await import("/src/level-up.ts");
        const { t } = await import("/src/i18n.ts");
        const s = createState();
        s.level = 9;
        s.choices = ["harpoon", "slag", "capacitor"];
        document.querySelector("#upgrade-title").textContent = t("Level up");
        document.querySelector("#upgrade-copy").textContent = t("Level {level} · Choose one upgrade.", { level: 9 });
        document.querySelector("#upgrade-choices").innerHTML = upgradeChoicesMarkup(s);
        await Promise.all([...document.querySelectorAll("#upgrade img")].map((img) => img.decode().catch(() => {})));
      });
      await page.screenshot({ path: `${directory}/level-up-${tag}.png` });
      await page.evaluate(() => {
        document.querySelector("#upgrade").classList.add("hidden");
        document.querySelector("#app").dataset.phase = "playing";
      });

      // Evolved loadout tiles and the build inspector, from a separate sample state.
      const inspector = await page.evaluate(async () => {
        const { createState } = await import("/src/simulation.ts");
        const { abilityLoadoutMarkup } = await import("/src/ability-loadout.ts");
        const { setupBuildInspector } = await import("/src/build-inspector.ts");
        const s = createState();
        Object.assign(s.upgrades, { saw: 0, harpoon: 5, slag: 5, burst: 5, capacitor: 2, amplifier: 2, magnet: 2 });
        Object.assign(s.evolutions, { winch: true, meltdown: true, reactor: true });
        s.specializations.slag = "slag_pool";
        s.phase = "playing";
        document.querySelector("#ability-loadout").innerHTML = abilityLoadoutMarkup(s);
        await Promise.all([...document.querySelectorAll(".ability-chip img")].map((img) => img.decode().catch(() => {})));
        const chips = [...document.querySelectorAll(".ability-chip")].map((c) => c.getBoundingClientRect());
        const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const pause = document.querySelector("#pause").getBoundingClientRect();
        const loadout = {
          tiles: chips.length,
          evolved: document.querySelectorAll(".ability-chip.is-evolved").length,
          labels: [...document.querySelectorAll(".ability-chip")].map((c) => c.getAttribute("aria-label")),
          inside: chips.every((r) => r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight),
          overlaps: chips.some((r, i) => chips.slice(i + 1).some((o) => overlap(r, o)) || overlap(r, pause)),
        };
        document.querySelector("#build-inspector")?.remove();
        const inspector = setupBuildInspector({ state: () => s, open: () => {}, close: () => {} });
        inspector.open("harpoon", document.querySelector("[data-owned-ability]"));
        const detail = [];
        for (const id of ["harpoon", "slag", "burst", "capacitor", "amplifier"]) {
          document.querySelector(`[data-inspect="${id}"]`).click();
          detail.push([id, document.querySelector("#build-inspector-detail h3").textContent, document.querySelector("#build-inspector-detail p").textContent.length]);
        }
        const dialog = document.querySelector("#build-inspector"), r = dialog.getBoundingClientRect();
        return { loadout, detail, fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth };
      });
      assert.equal(inspector.loadout.tiles, 6);
      assert.equal(inspector.loadout.evolved, 3);
      assert.equal(inspector.loadout.inside, true, `${tag} loadout inside`);
      assert.equal(inspector.loadout.overlaps, false, `${tag} loadout overlap`);
      assert.equal(inspector.fits, true, `${tag} build inspector fits`);
      const expected = locale === "en-US"
        ? { harpoon: "Scrap Winch", slag: "Meltdown", burst: "Pulse Reactor", capacitor: "Capacitor Bank", amplifier: "Field Amplifier" }
        : { harpoon: "Schrottwinde", slag: "Kernschmelze", burst: "Pulsreaktor", capacitor: "Kondensatorbank", amplifier: "Feldverstärker" };
      for (const [id, name, length] of inspector.detail) {
        assert.equal(name, expected[id], `${tag} ${id}`);
        assert.ok(length > 30);
      }
      await page.waitForFunction(() => [...document.querySelectorAll("#build-inspector img")].every((img) => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: `${directory}/build-inspector-${tag}.png` });
      report.ui.push({ locale, width, height, recipes, loadout: inspector.loadout, detail: inspector.detail });
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(`${directory}/arsenal-browser.json`, JSON.stringify({ report, errors }, null, 2));
  console.log(`PASS: harpoon, winch, slag, meltdown, pulse reactor and elites render from real updates at three viewports (pause, reduced motion, four presets, bounded geometry); recipes, level-up, specialization, loadout and build inspector fit at five viewports in English and German. Screenshots: ${directory}`);
} finally {
  await browser.close();
}
