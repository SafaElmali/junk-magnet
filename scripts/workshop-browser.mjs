import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
// Purchase tests deliberately seed a 600-part saved-game fixture. They do not
// claim these parts were naturally earned in a browser run.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const language of ["tr", "en", "de", "fr", "es", "pt"])
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 568],
      [568, 320],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        locale: language,
      });
      const errors = [],
        checks = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const report = {
        language,
        width,
        height,
        checks,
        fixture: "600 saved parts; UI purchases; real run config",
        errors,
      };
      await page.addInitScript(() => {
        if (!localStorage.getItem("junk-magnet-workshop-v1"))
          localStorage.setItem(
            "junk-magnet-workshop-v1",
            JSON.stringify({
              version: 1,
              parts: 600,
              selectedRobot: "scrap",
              unlockedRobots: ["scrap"],
              upgrades: { hull: 0, magnet: 0 },
              bestTime: 125,
              bestKills: 72,
              completedRuns: 2,
              recentRunIds: [],
            }),
          );
      });
      const check = async (name) => {
        const violations = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              ".menu-shell,.menu-panel,#menu-workshop-content,.workshop-machine,.workshop-upgrades,#menu-evolutions,.evolution-recipe,#intro button,#intro h3,#intro h4,#intro p",
            ),
          ]
            .filter((e) => e.getClientRects().length)
            .flatMap((e) => {
              const r = e.getBoundingClientRect();
              return e.scrollHeight > e.clientHeight + 2 ||
                e.scrollWidth > e.clientWidth + 2 ||
                r.top < -1 ||
                r.bottom > innerHeight + 1 ||
                r.left < -1 ||
                r.right > innerWidth + 1
                ? [
                    `${e.id || e.className}: ${e.clientWidth}x${e.clientHeight}/${e.scrollWidth}x${e.scrollHeight}, top=${r.top} bottom=${r.bottom}`,
                  ]
                : [];
            }),
        );
        assert.deepEqual(
          violations,
          [],
          `${language} ${width}x${height} ${name}`,
        );
        checks.push(name);
      };
      const snapshot = () =>
        page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
      const shot = async (name) => {
        await page.waitForFunction(() =>
          [...document.querySelectorAll("#intro img")]
            .filter((img) => img.getClientRects().length)
            .every((img) => img.complete && img.naturalWidth > 0),
        );
        if (language === "tr")
          await page.screenshot({
            path: `.impeccable/review/workshop-${name}-${width}.png`,
          });
      };
      try {
        await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
        await page.waitForFunction(() => window.__JUNK_MAGNET__);
        await check("home");
        await page.locator("#menu-workshop").click();
        await check("starter robot");
        await page.locator('[data-robot-step="1"]').click();
        await check("locked scout");
        await page.locator('[data-robot-action="unlock"]').click();
        await page.locator('[data-robot-action="select"]').click();
        assert.equal(
          await page.locator('[data-robot-action="select"]').isDisabled(),
          true,
        );
        await page.locator('[data-robot-step="1"]').click();
        await check("locked volt");
        await shot("robots");
        await page.locator('[data-workshop-tab="upgrades"]').click();
        await page.locator('[data-permanent-upgrade="hull"]').click();
        await check("permanent upgrades");
        await shot("upgrades");
        const saved = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("junk-magnet-workshop-v1")),
        );
        assert.equal(saved.parts, 495);
        assert.equal(saved.selectedRobot, "scout");
        assert.equal(saved.upgrades.hull, 1);
        await page.locator("#menu-back").click();
        assert.equal(
          await page.locator("#menu-pilot-name").textContent(),
          "SCOUT",
        );
        await page.locator("#menu-abilities").click();
        await check("abilities with evolution entry");
        await page.locator("#menu-evolutions-open").click();
        assert.equal(await page.locator(".evolution-recipe").count(), 3);
        await check("evolution recipes");
        await shot("evolutions");
        await page.locator("#menu-back").click();
        assert.equal(await page.locator("#menu-library").isVisible(), true);
        await page.locator("#menu-back").click();
        await page.locator("#start").click();
        await page.waitForFunction(
          () => window.__JUNK_MAGNET__.snapshot().time > 0.1,
        );
        let run = await snapshot();
        assert.equal(run.robot.robotId, "scout");
        assert.equal(run.robot.damageReduction, 1);
        assert.equal(run.robot.speedMultiplier, 1.18);
        await page.locator("#pause").click();
        await page.locator("#pause-menu").click();
        await check("resumable home");
        await page.locator("#menu-workshop").click();
        await page.locator('[data-workshop-tab="robots"]').click();
        await page.locator('[data-robot-step="1"]').click();
        await page.locator('[data-robot-action="unlock"]').click();
        await page.locator('[data-robot-action="select"]').click();
        await check("paused run robot selection");
        await page.locator('[data-workshop-tab="upgrades"]').click();
        await page.locator('[data-permanent-upgrade="hull"]').click();
        await check("paused run upgrades");
        const frozen = await snapshot();
        assert.equal(frozen.phase, "paused");
        assert.equal(frozen.robot.robotId, "scout");
        assert.equal(frozen.robot.damageReduction, 1);
        await page.locator("#menu-back").click();
        await page.locator("#start").click();
        assert.equal((await snapshot()).robot.robotId, "scout");
        await page.locator("#pause").click();
        await page.locator("#pause-menu").click();
        await page.locator("#new-run").click();
        run = await snapshot();
        assert.equal(run.robot.robotId, "volt");
        assert.equal(run.robot.damageReduction, 2);
        assert.equal(run.upgrades.lightning, 1);
        await page.reload();
        await page.waitForFunction(() => window.__JUNK_MAGNET__);
        assert.equal(
          await page.locator("#menu-pilot-name").textContent(),
          "VOLT",
        );
        assert.deepEqual(errors, []);
        checks.push(
          "paid unlock, selection, persistent upgrades, immutable paused config, new run config, reload",
        );
        report.pass = true;
      } catch (error) {
        report.pass = false;
        report.failure = String(error);
        await page.screenshot({
          path: `.impeccable/review/workshop-failure-${language}-${width}.png`,
        });
      }
      reports.push(report);
      console.log(
        report.pass ? "PASS" : "FAIL",
        language,
        width,
        height,
        report.failure ?? "",
      );
      await page.close();
    }
} finally {
  await browser.close();
  await fs.writeFile(
    ".impeccable/review/workshop-browser.json",
    JSON.stringify(reports, null, 2),
  );
}
assert.equal(
  reports.filter((report) => !report.pass).length,
  0,
  "See workshop-browser.json for failed cases",
);
