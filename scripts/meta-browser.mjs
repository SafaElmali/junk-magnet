// Meta features in a real browser: home entries, stage picker, Daily Shift and Work
// Orders pages, paged workshop upgrades, and a naturally finished Daily Shift run whose
// result lists completed work orders. Saved progress is a seeded fixture (as in
// workshop-browser.mjs); the run itself is real keyboard play. The date is fixed so the
// daily rule is known. Screenshots go to SCREENSHOT_DIR or a new temporary folder.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5184/play/";
const out =
  process.env.SCREENSHOT_DIR ??
  (await fs.mkdtemp(path.join(os.tmpdir(), "junk-magnet-meta-")));
const viewports = [
  [1440, 900],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
];
const now = new Date(2026, 8, 24, 18, 30);
const copy = {
  en: { rule: "Glass Swarm", day: "day 4", orders: "WORK ORDERS" },
  de: { rule: "Glasschwarm", day: "Tag 4", orders: "AUFTRÄGE" },
};
const fixture = {
  version: 1,
  parts: 700,
  selectedRobot: "scout",
  unlockedRobots: ["scrap", "scout"],
  upgrades: { hull: 1 },
  bestTime: 312,
  bestKills: 410,
  completedRuns: 12,
  recentRunIds: [],
  stats: { kills: 9990, bosses: 1, minibosses: 2, bestLevel: 14, bestChests: 1 },
  evolutions: [],
  robotsUsed: ["scrap"],
  orders: ["survive-2", "survive-5", "miniboss", "boss", "level-10", "daily"],
  ordersSeen: 4,
  daily: { date: "2026-09-23", best: 250, streak: 2, longest: 2, days: 2 },
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];

/** Overflow, off-screen and overlap problems among visible elements under `root`. */
const layoutIssues = (page, root) =>
  page.evaluate((root) => {
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return e.getClientRects().length && r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== "hidden";
    };
    const issues = [];
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${e.className && typeof e.className === "string" ? `.${e.className.split(" ").join(".")}` : ""}`;
    for (const panel of document.querySelectorAll(
      `${root} .menu-shell, ${root} .menu-panel, ${root} #menu-orders-content, ${root} .order-list, ${root} .workshop-upgrades, ${root} #menu-daily-content, ${root}.modal-card, ${root} .result-orders`,
    ))
      if (visible(panel) && (panel.scrollHeight > panel.clientHeight + 2 || panel.scrollWidth > panel.clientWidth + 2))
        issues.push(`${name(panel)} overflows ${panel.scrollWidth}x${panel.scrollHeight} > ${panel.clientWidth}x${panel.clientHeight}`);
    for (const e of document.querySelectorAll(`${root} button, ${root} h2, ${root} h3, ${root} h4, ${root} p, ${root} li, ${root} strong`)) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
        issues.push(`${name(e)} off-screen ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    // Cards: children stay inside, and copy never runs under the card's price or reward.
    for (const card of document.querySelectorAll(
      `${root} .workshop-upgrade, ${root} .order-card, ${root} .stage-option, ${root} .result-line, ${root} .menu-actions .menu-button, ${root} .daily-stats > div, ${root} .order-tabs button`,
    )) {
      if (!visible(card)) continue;
      const c = card.getBoundingClientRect();
      const parts = [...card.querySelectorAll("*")].filter(visible);
      for (const child of parts) {
        const r = child.getBoundingClientRect();
        if (r.left < c.left - 1 || r.top < c.top - 1 || r.right > c.right + 1 || r.bottom > c.bottom + 1)
          issues.push(`${name(child)} leaves ${name(card)}`);
      }
      const texts = parts.filter((e) => e.matches("h4, strong, p, .order-status, .result-line-text, .stage-copy span, .menu-daily-copy small"));
      const controls = parts.filter((e) => e.matches(".workshop-buy, .order-reward, .result-line-reward, .stage-status, .menu-parts, .menu-streak"));
      for (const text of texts)
        for (const control of controls) {
          if (text.contains(control) || control.contains(text)) continue;
          const a = text.getBoundingClientRect(),
            b = control.getBoundingClientRect();
          const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (overlap > 2) issues.push(`${name(text)} overlaps ${name(control)} in ${name(card)}`);
        }
    }
    return [...new Set(issues)];
  }, root);
const imagesReady = (page) =>
  page.waitForFunction(() =>
    [...document.querySelectorAll("#intro img, #result img")]
      .filter((img) => img.getClientRects().length)
      .every((img) => img.complete && img.naturalWidth > 0),
  );

async function openPage(language, [width, height], save = fixture) {
  const page = await browser.newPage({ viewport: { width, height }, locale: language, hasTouch: width < 900, isMobile: width < 900 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(now);
  await page.addInitScript((save) => {
    if (!sessionStorage.getItem("meta-seeded")) {
      localStorage.setItem("junk-magnet-workshop-v1", JSON.stringify(save));
      sessionStorage.setItem("meta-seeded", "1");
    }
  }, save);
  await page.goto(url);
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await imagesReady(page);
  return { page, errors };
}
const saved = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("junk-magnet-workshop-v1")));
const snapshot = (page) => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
const activeId = (page) =>
  page.evaluate(() => document.activeElement?.id || document.activeElement?.dataset.stage || "");

async function menuPages(language, viewport) {
  const [width, height] = viewport;
  const tag = `${language}-${width}x${height}`;
  const { page, errors } = await openPage(language, viewport);
  const checks = [],
    layout = [];
  // Layout problems are collected so one run reports every page that needs work.
  const check = async (label, root = "#intro") => {
    await page.waitForTimeout(80);
    await imagesReady(page);
    for (const issue of await layoutIssues(page, root)) layout.push(`${label}: ${issue}`);
    checks.push(label);
  };
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}-${tag}.png`) });
  try {
    // Home: both new entries, badges, the picker, and arrow keys through every control.
    await check("home");
    await shot("home");
    assert.match(await page.locator("#menu-daily [data-daily-detail]").innerText(), new RegExp(copy[language].rule));
    assert.equal((await page.locator("#menu-daily [data-daily-streak]").innerText()).trim(), "2");
    assert.equal(await page.locator("#menu-orders-new").innerText(), "2");
    assert.equal(await page.locator("#menu-orders > span").innerText(), copy[language].orders);
    assert.equal(await page.locator(".stage-option").count(), 2);
    assert.equal(await page.locator('#menu-stage [data-stage="night"]').getAttribute("aria-disabled"), "true");
    // Players can still tap the locked option; it keeps the Scrapyard selected.
    await page.locator('#menu-stage [data-stage="night"]').click({ force: true });
    assert.equal(await page.locator('#menu-stage [data-stage="yard"]').getAttribute("aria-pressed"), "true");
    assert.notEqual((await saved(page)).stage, "night");
    await page.locator("#start").focus();
    const cycle = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("ArrowDown");
      const id = await activeId(page);
      if (id === "start") break;
      cycle.push(id);
    }
    const core = ["menu-daily", "menu-workshop", "menu-orders", "menu-abilities", "menu-settings", "menu-help", "yard", "night"];
    assert.deepEqual(cycle.filter((id) => core.includes(id)), core, `${tag} arrow order ${cycle}`);
    checks.push("arrow keys reach every home control, including the stage picker");

    // Daily Shift page.
    await page.locator("#menu-daily").click();
    await check("daily page");
    await shot("daily");
    const daily = await page.locator("#menu-daily-content").innerText();
    assert.match(daily, new RegExp(copy[language].rule));
    assert.match(daily, /\+35/);
    assert.equal(await activeId(page), "daily-start");
    await page.keyboard.press("Escape");
    assert.equal(await activeId(page), "menu-daily");

    // Work Orders: opens on the new completions, then every tab and page fits.
    await page.locator("#menu-orders").click();
    await check("work orders");
    await shot("orders");
    assert.equal(await page.locator(".order-tabs button").count(), 6);
    assert.ok((await page.locator(".order-card.is-new").count()) >= 1, "new orders are highlighted");
    for (const group of ["survival", "combat", "builds", "explorer", "robots", "challenges"]) {
      await page.locator(`[data-order-group="${group}"]`).click();
      await check(`orders ${group}`);
      while (!(await page.locator('[data-order-page="1"]').isDisabled())) {
        await page.locator('[data-order-page="1"]').click();
        await check(`orders ${group} next page`);
      }
    }
    await page.keyboard.press("Escape");
    assert.equal(await activeId(page), "menu-orders");
    assert.equal(await page.locator("#menu-orders-new").isVisible(), false, "visiting clears the badge");
    assert.equal((await saved(page)).ordersSeen, fixture.orders.length);

    // Workshop upgrades: every page fits, and a purchase is saved.
    await page.locator("#menu-workshop").click();
    await page.locator('[data-workshop-tab="upgrades"]').click();
    await check("workshop upgrades");
    await shot("upgrades");
    const seen = new Set();
    for (;;) {
      for (const id of await page.locator("[data-permanent-upgrade]").evaluateAll((els) => els.map((e) => e.dataset.permanentUpgrade)))
        seen.add(id);
      if (!(await page.locator('[data-upgrade-page="1"]').count()) || (await page.locator('[data-upgrade-page="1"]').isDisabled())) break;
      await page.locator('[data-upgrade-page="1"]').click();
      await check("workshop upgrades next page");
    }
    assert.equal(seen.size, 8);
    while (!(await page.locator('[data-permanent-upgrade="rerolls"]').count()))
      await page.locator('[data-upgrade-page="-1"]').click();
    await page.locator('[data-permanent-upgrade="rerolls"]').click();
    const after = await saved(page);
    assert.equal(after.upgrades.rerolls, 1);
    assert.equal(after.parts, fixture.parts - 50);
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.permanentUpgrade),
      "rerolls",
      "focus stays on the upgrade card",
    );
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    assert.deepEqual([...new Set(layout)], [], `${tag} layout`);
    return { language, width, height, pass: true, checks };
  } finally {
    await page.close();
  }
}

/** Walks into the nearest enemy until the robot is defeated, choosing non-repair upgrades. */
async function playUntilDefeated(page) {
  for (let i = 0; i < 1500; i++) {
    const s = await snapshot(page);
    if (s.phase === "lost") return s;
    if (s.phase === "upgrade") {
      await page.locator('#upgrade-choices button:not([data-upgrade="repair"])').first().click();
      continue;
    }
    const e = s.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
    const keys = e
      ? [
          ...(Math.abs(e.x - s.player.x) > 0.12 ? [e.x > s.player.x ? "KeyD" : "KeyA"] : []),
          ...(Math.abs(e.z - s.player.z) > 0.12 ? [e.z > s.player.z ? "KeyS" : "KeyW"] : []),
        ]
      : [];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(70);
    for (const k of keys) await page.keyboard.up(k);
  }
  throw new Error("The run did not end");
}

async function dailyRun(language) {
  const { page, errors } = await openPage(language, viewports[0]);
  const checks = [];
  try {
    const before = await saved(page);
    await page.locator("#menu-daily").click();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "playing");
    const shift = await page.evaluate(async () => {
      const { getDailyShift } = await import("/src/daily-shift.ts");
      return getDailyShift();
    });
    let s = await snapshot(page);
    assert.equal(s.robot.daily, "2026-09-24");
    assert.equal(s.robot.seed, shift.seed);
    assert.equal(s.robot.stage, "yard");
    assert.deepEqual(s.robot.modifiers, shift.rule.modifiers);
    assert.equal(s.robot.robotId, "scout");
    checks.push("Daily Shift page starts today's seeded run with its rule");
    s = await playUntilDefeated(page);
    await page.locator("#result").waitFor({ state: "visible" });
    const receipt = s.receipt ?? (await snapshot(page)).receipt;
    const ids = receipt.orders.map((o) => o.id);
    for (const id of ["robot-scout", "streak-3", "kills-10k"]) assert.ok(ids.includes(id), `${id} in ${ids}`);
    assert.equal(receipt.daily.first, true);
    assert.equal(receipt.daily.streak, 3);
    assert.equal(receipt.daily.reward, 35);
    const rewards = receipt.orders.reduce((sum, o) => sum + o.reward, 0);
    assert.equal(receipt.parts, before.parts + receipt.earned + rewards + 35);
    assert.equal(typeof receipt.runId, "string");
    const afterRun = await saved(page);
    assert.equal(afterRun.daily.date, "2026-09-24");
    assert.equal(afterRun.daily.streak, 3);
    assert.equal(await activeId(page), "again", "ONE MORE SHIFT keeps focus");
    checks.push(`natural defeat after ${Math.round(s.time)} s: ${ids.length} orders, daily +35, streak 3`);
    for (const viewport of viewports) {
      const [width, height] = viewport;
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      await imagesReady(page);
      const tag = `${language}-${width}x${height}`;
      assert.deepEqual(await layoutIssues(page, "#result .modal-card"), [], `${tag} result`);
      const lines = await page.locator("#result-orders .result-line").evaluateAll((els) =>
        els.filter((e) => e.getClientRects().length).map((e) => e.innerText.replace(/\s+/g, " ")),
      );
      assert.ok(lines.length >= 1, `${tag} shows work order lines`);
      if (width === 1440) {
        assert.ok(lines.length >= 5, `${tag} lists orders and goals: ${lines}`);
        assert.ok(lines.some((line) => line.includes(copy[language].day)), `${tag} daily come-back line: ${lines}`);
      }
      assert.equal(await activeId(page), "again");
      await page.screenshot({ path: path.join(out, `result-${tag}.png`) });
      checks.push(`result ${width}x${height}: ${lines.length} lines`);
    }
    // One input retries: Enter on the focused ONE MORE SHIFT starts another daily attempt.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "playing");
    s = await snapshot(page);
    assert.equal(s.robot.daily, "2026-09-24");
    assert.ok(s.time < 2 && s.kills === 0);
    checks.push("Enter on ONE MORE SHIFT starts another Daily Shift attempt");
    assert.deepEqual(errors, []);
    return { language, flow: "daily run", pass: true, checks };
  } finally {
    await page.close();
  }
}

async function stageFlow() {
  const cleared = { ...fixture, clearedStages: ["yard"], stageBest: { yard: 900 } };
  const { page, errors } = await openPage("en", [844, 390], cleared);
  try {
    assert.equal(await page.locator('#menu-stage [data-stage="night"]').getAttribute("aria-disabled"), null);
    await page.locator('#menu-stage [data-stage="night"]').click();
    assert.equal((await saved(page)).stage, "night");
    assert.equal(await page.locator('#menu-stage [data-stage="night"]').getAttribute("aria-pressed"), "true");
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().time > 0.2);
    assert.equal((await snapshot(page)).robot.stage, "night");
    assert.equal((await snapshot(page)).robot.daily, null);
    await page.keyboard.press("Escape");
    await page.locator("#pause-menu").click();
    assert.deepEqual(await layoutIssues(page, "#intro"), [], "resumable home with Night Shift");
    // The Daily Shift page warns that starting ends the paused run.
    await page.locator("#menu-daily").click();
    assert.match(await page.locator(".daily-note").innerText(), /paused run/);
    await page.locator("#daily-start").click();
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "playing");
    const s = await snapshot(page);
    assert.equal(s.robot.daily, "2026-09-24");
    assert.equal(s.robot.stage, "yard", "Daily Shifts always use the Scrapyard");
    assert.ok(s.time < 1);
    await page.reload();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(await page.locator('#menu-stage [data-stage="night"]').getAttribute("aria-pressed"), "true");
    assert.deepEqual(errors, []);
    return { flow: "stage picker", pass: true, checks: ["Night Shift selected, saved, used by PLAY; Daily Shift ends a paused run on the Scrapyard"] };
  } finally {
    await page.close();
  }
}

const run = async (label, flow) => {
  try {
    const report = await flow();
    reports.push(report);
    console.log("PASS", label, report.checks.at(-1));
  } catch (error) {
    reports.push({ label, pass: false, failure: String(error.message ?? error) });
    console.log("FAIL", label, String(error.message ?? error));
  }
};
try {
  for (const language of ["en", "de"])
    for (const viewport of viewports)
      await run(`${language} ${viewport.join("x")} menus`, () => menuPages(language, viewport));
  await run("stage picker", stageFlow);
  for (const language of ["en", "de"])
    await run(`${language} daily run and result`, () => dailyRun(language));
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "meta-browser.json"), JSON.stringify(reports, null, 2));
  console.log("Screenshots and report:", out);
}
assert.equal(
  reports.filter((report) => !report.pass).length,
  0,
  "See meta-browser.json for failed cases",
);
