// Run rules in the real game: level-up reroll/banish at five viewports (English and German),
// a revive, the 15:00 final boss and victory screen, and the Night Shift on two graphics presets.
// Level-ups come from real play. Late-run states use the dev-only __JUNK_MAGNET_DEV__ hook, so
// point GAME_URL at a Vite dev server: npx vite --host 127.0.0.1 --port 5302 --strictPort
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5302/play/";
const out =
  process.env.RUN_RULES_OUT ??
  (await fs.mkdtemp(path.join(os.tmpdir(), "junk-magnet-run-rules-")));
await fs.mkdir(out, { recursive: true });
const viewports = [
  [1440, 900],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { out, levelUp: [], revive: [], victory: [], night: [], errors: [] };

async function open([width, height], language = "en", quality) {
  const touch = width < 900;
  const page = await browser.newPage({
    viewport: { width, height },
    locale: language === "de" ? "de-DE" : "en-US",
    hasTouch: touch,
    isMobile: touch,
  });
  page.on("pageerror", (e) => report.errors.push(`${width}x${height}: ${e.message}`));
  if (quality)
    await page.addInitScript((q) => localStorage.setItem("junk-magnet-graphics", q), quality);
  await page.goto(url);
  await page.waitForFunction(() => window.__JUNK_MAGNET__ && window.__JUNK_MAGNET_DEV__);
  return { page, touch };
}
const snapshot = (page) => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
const dev = (page, fn, arg) => page.evaluate(fn, arg);
/** Everything in the sheet stays inside it and the viewport; labels are never truncated. */
function sheetIssues() {
  const sheet = document.querySelector(".upgrade-sheet"),
    r = sheet.getBoundingClientRect(),
    issues = [];
  if (sheet.scrollHeight > sheet.clientHeight + 1 || sheet.scrollWidth > sheet.clientWidth + 1)
    issues.push(`sheet overflow ${sheet.scrollHeight}/${sheet.clientHeight}`);
  for (const el of document.querySelectorAll(
    "#upgrade button, #upgrade .upgrade-description, #upgrade .upgrade-name-row, #upgrade-copy",
  )) {
    if (!el.getClientRects().length) continue;
    const b = el.getBoundingClientRect();
    if (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1 || b.bottom > innerHeight)
      issues.push(`${el.className || el.id} clipped`);
  }
  for (const label of document.querySelectorAll("#upgrade-tools .upgrade-tool > span"))
    if (label.scrollWidth > label.clientWidth + 1) issues.push(`tool label truncated: ${label.textContent}`);
  const [a, b] = [...document.querySelectorAll("#upgrade-tools .upgrade-tool")].map((t) => t.getBoundingClientRect());
  if (a && b && a.right > b.left && a.bottom > b.top && a.top < b.bottom) issues.push("tools overlap");
  const heading = document.querySelector(".upgrade-heading").getBoundingClientRect();
  if (a && a.top < heading.bottom && a.bottom > heading.top && a.left < heading.right && heading.left < a.right)
    issues.push("tools overlap the heading");
  return issues;
}
async function tap(page, touch, selector) {
  const target = page.locator(selector).first();
  if (touch) await target.tap();
  else await target.click();
}

try {
  // 1. Level-up tools from real play: reroll, arm and cancel a banish, then banish a card.
  for (const language of ["en", "de"])
    for (const viewport of viewports) {
      const [width, height] = viewport;
      const { page, touch } = await open(viewport, language);
      await page.locator("#start").click();
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(650);
      await page.keyboard.up("KeyD");
      await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "upgrade");
      await page.waitForFunction(() => [...document.querySelectorAll("#upgrade img")].every((i) => i.complete && i.naturalWidth));
      await page.waitForTimeout(300);
      const tools = page.locator("#upgrade-tools .upgrade-tool");
      assert.equal(await tools.count(), 2);
      assert.deepEqual(await page.locator("#upgrade-tools b").allTextContents(), ["1", "1"]);
      assert.deepEqual(await page.evaluate(sheetIssues), [], `${width}x${height} ${language} sheet`);
      const note = await page.locator("#upgrade-note").textContent();
      assert.match(note, /R .*X /, "the note shows both shortcuts");
      await page.screenshot({ path: `${out}/level-up-${language}-${width}x${height}.png` });
      const before = await dev(page, () => [...window.__JUNK_MAGNET_DEV__.state().choices]);
      if (touch) await tap(page, touch, '[data-tool="reroll"]');
      else await page.keyboard.press("r");
      const after = await dev(page, () => [...window.__JUNK_MAGNET_DEV__.state().choices]);
      assert.equal(after.length, 3);
      assert.ok(after.every((id) => !before.includes(id)), `${before} -> ${after}`);
      assert.equal(await page.locator('[data-tool="reroll"]').isDisabled(), true);
      await page.waitForTimeout(300);
      if (touch) await tap(page, touch, '[data-tool="banish"]');
      else await page.keyboard.press("x");
      await page.waitForFunction(() => document.querySelector("#upgrade").classList.contains("is-banishing"));
      assert.equal(await page.locator('[data-tool="banish"]').getAttribute("aria-pressed"), "true");
      assert.ok((await page.locator('#upgrade-choices [data-banish="target"]').count()) > 0);
      assert.equal(await page.locator('#upgrade-choices [data-banish="target"]:focus').count(), 1, "focus moves to a target");
      assert.deepEqual(await page.evaluate(sheetIssues), [], `${width}x${height} ${language} armed`);
      await page.screenshot({ path: `${out}/level-up-${language}-${width}x${height}-banish.png` });
      if (touch) await tap(page, touch, '[data-tool="banish"]');
      else await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#upgrade").classList.contains("is-banishing"));
      await page.waitForTimeout(300);
      if (touch) await tap(page, touch, '[data-tool="banish"]');
      else await page.keyboard.press("x");
      await page.waitForTimeout(300);
      const target = await page.locator('#upgrade-choices [data-banish="target"]').first().getAttribute("data-upgrade");
      const slot = Number(await page.locator('#upgrade-choices [data-banish="target"]').first().getAttribute("data-choice"));
      if (touch) await tap(page, touch, `#upgrade-choices [data-upgrade="${target}"]`);
      else await page.keyboard.press(`Digit${slot + 1}`);
      const banished = await dev(page, () => {
        const s = window.__JUNK_MAGNET_DEV__.state();
        return { banished: [...s.banished], choices: [...s.choices], banishes: s.banishes, stats: { ...s.stats } };
      });
      assert.deepEqual(banished.banished, [target]);
      assert.ok(!banished.choices.includes(target));
      assert.equal(banished.stats.rerollsUsed, 1);
      assert.equal(banished.stats.banishesUsed, 1);
      assert.equal(await page.locator('[data-tool="banish"]').isDisabled(), true);
      assert.equal(await page.locator(`#upgrade-choices [data-choice="${slot}"]:focus`).count(), 1, "focus stays on the refilled slot");
      await page.waitForTimeout(300);
      if (touch) await tap(page, touch, "#upgrade-choices .upgrade-choice");
      else await page.keyboard.press("Digit1");
      await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "playing");
      report.levelUp.push({ language, width, height, before, after, banished });
      await page.close();
      console.log(`PASS level-up tools ${language} ${width}x${height}`);
    }

  // 2. A revive: lethal contact spends it, the cue shows and the HUD count updates.
  for (const viewport of [viewports[0], viewports[1]]) {
    const [width, height] = viewport;
    const { page } = await open(viewport);
    await dev(page, () => window.__JUNK_MAGNET_DEV__.rerun({ revives: 1 }));
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#revive-chip").isVisible(), true);
    assert.equal(await page.locator("#revives").textContent(), "1");
    await dev(page, () => {
      const s = window.__JUNK_MAGNET_DEV__.state();
      s.hp = 2;
      s.openingRemaining = 0;
      for (let i = 0; i < 6; i++)
        s.enemies.push({ id: s.nextId++, type: "can", x: s.player.x + Math.cos(i) * 0.4, z: s.player.z + Math.sin(i) * 0.4, hp: 200, hit: 0, seed: i });
    });
    await page.waitForFunction(() => window.__JUNK_MAGNET_DEV__.state().stats.revivesUsed === 1);
    const revived = await dev(page, () => {
      const s = window.__JUNK_MAGNET_DEV__.state();
      return { hp: s.hp, revives: s.revives, phase: s.phase, immunity: s.immunity };
    });
    assert.equal(revived.phase, "playing");
    assert.ok(revived.hp > 0 && revived.hp <= 50);
    assert.equal(revived.revives, 0);
    await page.locator("#run-cue").waitFor({ state: "visible" });
    assert.equal(await page.locator("#run-cue-title").textContent(), "REVIVED");
    assert.equal(await page.locator("#run-cue-copy").textContent(), "No revives left");
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/revive-${width}x${height}.png` });
    assert.equal(await page.locator("#revive-chip").isVisible(), false);
    await page.locator("#run-cue").waitFor({ state: "hidden", timeout: 5000 });
    report.revive.push({ width, height, ...revived });
    await page.close();
    console.log(`PASS revive ${width}x${height}`);
  }

  // 3. The 15:00 goal, the final boss and the victory screen, in both stages.
  for (const [stage, stamp] of [
    ["yard", "YARD CLEARED"],
    ["night", "NIGHT SHIFT CLEARED"],
  ])
    for (const viewport of stage === "yard" ? viewports : [viewports[0], viewports[1]]) {
      const [width, height] = viewport;
      const { page } = await open(viewport);
      await dev(page, (stage) => window.__JUNK_MAGNET_DEV__.rerun({ stage }), stage);
      await page.waitForTimeout(300);
      assert.equal(await page.locator("#timer-goal").isVisible(), true);
      assert.match(await page.locator("#timer-goal").textContent(), /15:00/);
      const hud = await page.evaluate(() => {
        const goal = document.querySelector("#timer-goal").getBoundingClientRect();
        return ["#ability-loadout", "#pause", ".salvage-panel"].filter((selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return goal.left < r.right && goal.right > r.left && goal.top < r.bottom && goal.bottom > r.top;
        });
      });
      assert.deepEqual(hud, [], `${width}x${height} goal overlaps`);
      await dev(page, () => {
        const s = window.__JUNK_MAGNET_DEV__.state();
        s.time = 899.5;
        s.encounters.nextAt = 900;
        s.encounters.active = null;
        s.enemies = [];
        s.immunity = 1e6;
      });
      await page.waitForFunction(() => window.__JUNK_MAGNET_DEV__.state().enemies.some((e) => e.final));
      await dev(page, () => {
        const s = window.__JUNK_MAGNET_DEV__.state();
        const boss = s.enemies.find((e) => e.final);
        boss.x = s.player.x + 4.5;
        boss.z = s.player.z - 3.5;
      });
      await page.locator("#boss-hud").waitFor({ state: "visible" });
      assert.equal(await page.locator("#boss-hud.is-final").count(), 1);
      assert.equal(await page.locator("#boss-name").textContent(), "FINAL BOSS · Scrap Colossus");
      assert.equal(await page.locator("#run-cue-title").textContent(), "FINAL BOSS");
      assert.equal(await page.locator("#timer-goal").isVisible(), false, "the goal gives way to the boss");
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${out}/final-boss-${stage}-${width}x${height}.png` });
      await dev(page, () => {
        const s = window.__JUNK_MAGNET_DEV__.state();
        s.enemies.find((e) => e.final).hp = 0.5;
        s.scrap = 12;
        s.cooldown = 0;
      });
      await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "won", undefined, { timeout: 15000 });
      await page.locator("#result").waitFor({ state: "visible" });
      assert.equal(await page.locator("#result-stamp").textContent(), stamp);
      assert.equal(await page.locator("#result-title").textContent(), "SHIFT CLEARED");
      assert.match(await page.locator("#result-copy").textContent(), /Scrap Colossus/);
      assert.match(await page.locator("#result-reward").textContent(), /\+\d+ parts/);
      assert.equal(await page.locator("#result.is-cleared").count(), 1);
      assert.equal(await page.locator("#pause").isVisible(), false);
      assert.equal(await page.locator("#help").isVisible(), false);
      assert.ok(await page.evaluate(() => document.activeElement?.id === "again"));
      const won = await snapshot(page);
      assert.ok(won.receipt.earned >= 100, "the Colossus pays its parts");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/victory-${stage}-${width}x${height}.png` });
      const layout = await page.evaluate(() => {
        const root = document.querySelector("#result .modal-card"),
          r = root.getBoundingClientRect(),
          issues = [];
        if (root.scrollHeight > root.clientHeight + 2 || root.scrollWidth > root.clientWidth + 2) issues.push("overflow");
        for (const el of root.querySelectorAll("button,h2,.result-stamp,.result-stats>div")) {
          if (!el.getClientRects().length) continue;
          const b = el.getBoundingClientRect();
          if (b.top < 0 || b.bottom > innerHeight + 1 || b.left < 0 || b.right > innerWidth + 1 || b.bottom > r.bottom + 1)
            issues.push(`${el.id || el.className} clipped`);
        }
        return issues;
      });
      assert.deepEqual(layout, [], `${stage} ${width}x${height} victory layout`);
      // Pause stays unavailable, and a language change redraws the result without recording again.
      await page.keyboard.press("Escape");
      assert.equal((await snapshot(page)).phase, "won");
      await page.locator("#language").click();
      await page.locator("#language").click();
      assert.notEqual(await page.locator("#result-stamp").textContent(), stamp);
      assert.deepEqual((await snapshot(page)).receipt, won.receipt);
      if (stage === "yard" && width === 1440) {
        await page.locator("#result-menu").click();
        await page.locator("#start").waitFor({ state: "visible" });
        assert.match(await page.locator("#start").textContent(), /PLAY|OYNA|SPIEL|JOUER|JUGAR|JOGAR/i);
        await page.locator("#start").click();
        const fresh = await snapshot(page);
        assert.equal(fresh.phase, "playing");
        assert.ok(fresh.time < 1);
      }
      report.victory.push({ stage, width, height, receipt: won.receipt, time: won.time });
      await page.close();
      console.log(`PASS final boss and victory ${stage} ${width}x${height}`);
    }

  // German victory copy at every viewport.
  for (const viewport of viewports) {
    const [width, height] = viewport;
    const { page } = await open(viewport, "de");
    await dev(page, () => window.__JUNK_MAGNET_DEV__.rerun({ stage: "night" }));
    await dev(page, () => {
      const s = window.__JUNK_MAGNET_DEV__.state();
      s.time = 899.9;
      s.encounters.nextAt = 900;
      s.enemies = [];
      s.immunity = 1e6;
    });
    await page.waitForFunction(() => window.__JUNK_MAGNET_DEV__.state().enemies.some((e) => e.final));
    assert.equal(await page.locator("#boss-name").textContent(), "ENDBOSS · Schrottkoloss");
    await dev(page, () => {
      window.__JUNK_MAGNET_DEV__.state().encounters.cleared = true;
    });
    await page.locator("#result").waitFor({ state: "visible" });
    assert.equal(await page.locator("#result-title").textContent(), "GESCHAFFT!");
    assert.equal(await page.locator("#result-stamp").textContent(), "NACHTSCHICHT GEMEISTERT");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/victory-de-${width}x${height}.png` });
    const overflow = await page.evaluate(() => {
      const root = document.querySelector("#result .modal-card");
      const title = document.querySelector("#result-title");
      const stamp = document.querySelector(".result-stamp").getBoundingClientRect();
      return root.scrollHeight > root.clientHeight + 2 || root.scrollWidth > root.clientWidth + 2 || title.scrollWidth > title.clientWidth + 1 || stamp.right > root.getBoundingClientRect().right;
    });
    assert.equal(overflow, false, `${width}x${height} German victory`);
    await page.close();
    console.log(`PASS German victory ${width}x${height}`);
  }

  // 4. Night Shift look on the lightest and a shadowed, post-processed preset.
  for (const quality of ["performance", "high"])
    for (const viewport of [viewports[0], viewports[1]]) {
      const [width, height] = viewport;
      const { page } = await open(viewport, "en", quality);
      await dev(page, () => window.__JUNK_MAGNET_DEV__.rerun({ stage: "night" }));
      await dev(page, () => {
        const s = window.__JUNK_MAGNET_DEV__.state();
        s.time = 150;
        s.immunity = 1e6;
      });
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(2500);
      await page.keyboard.up("KeyD");
      await page.waitForTimeout(2500);
      const state = await snapshot(page);
      assert.equal(await page.evaluate(() => document.querySelector("#app").dataset.stage), "night");
      assert.equal(state.world.graphics.quality, quality);
      assert.equal(state.world.graphics.postProcessing, quality === "high");
      await page.screenshot({ path: `${out}/night-${quality}-${width}x${height}.png` });
      report.night.push({ quality, width, height, drawCalls: state.drawCalls, enemies: state.enemyCount, frames: state.world.frames });
      await page.close();
      console.log(`PASS Night Shift ${quality} ${width}x${height}`);
    }

  assert.deepEqual(report.errors, []);
  await fs.writeFile(`${out}/run-rules-browser.json`, JSON.stringify(report, null, 2));
  console.log(`Screenshots and report: ${out}`);
} finally {
  await browser.close();
}
