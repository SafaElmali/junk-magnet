import { cycleToolbarLanguage } from "./language-controls.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const [width, height, mobile] of [
    [1440, 900, false],
    [390, 844, true],
    [844, 390, true],
    [320, 740, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      locale: "tr-TR",
      isMobile: mobile,
      hasTouch: mobile,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    await page.locator("#start").click();
    await page.waitForTimeout(150);
    const layout = await page.evaluate(() => {
      const rect = (s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };
      return {
        yard: rect("#yard"),
        pause: rect("#pause"),
        launchButtons: document.querySelectorAll("#launch").length,
        health: rect(".health-track"),
        timerFont: getComputedStyle(document.querySelector("#timer")).fontSize,
        visibleControls: [...document.querySelectorAll(".masthead button")]
          .filter((b) => b.getBoundingClientRect().width)
          .map((b) => b.id),
        footer: getComputedStyle(document.querySelector(".workbench")).display,
        lowerHud: document.querySelectorAll("#lower-hud").length,
      };
    });
    assert.equal(layout.yard.width, width);
    assert.equal(layout.yard.height, height);
    assert.deepEqual(layout.visibleControls, ["pause"]);
    assert.equal(layout.footer, "none");
    assert.equal(layout.lowerHud, 0);
    assert.ok(parseFloat(layout.timerFont) <= 22);
    assert.equal(layout.launchButtons, 0);
    assert.ok(layout.health.width <= 60 && layout.health.height <= 7);
    await page.screenshot({
      path: `.impeccable/review/compact-hud-${width}.png`,
    });
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().launched > 0,
    );
    await page.locator("#pause").click();
    const frozen = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    await page.waitForTimeout(1300);
    const afterPause = await page.evaluate(() =>
      window.__JUNK_MAGNET__.snapshot(),
    );
    assert.equal(afterPause.time, frozen.time);
    assert.equal(afterPause.launched, frozen.launched);
    await cycleToolbarLanguage(page, "en");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await cycleToolbarLanguage(page, "tr");
    await page.locator("#help").click();
    for (let step = 0; step < 3; step++)
      await page.locator("#help-next").click();
    assert.match(
      await page.locator("#help-content").innerText(),
      /Mavi enerji/,
    );
    await page.locator("#resume").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().phase === "upgrade",
      null,
      { timeout: 40000 },
    );
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#upgrade-choices button").count(), 3);
    assert.equal(
      await page.locator("#upgrade-title").innerText(),
      "Seviye atladın",
    );
    await page.screenshot({
      path: `.impeccable/review/compact-upgrade-${width}.png`,
    });
    await page.locator("#upgrade-choices button").first().click();
    assert.equal(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().phase),
      "playing",
    );
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      mobile,
      layout,
      upgrade: "passed",
      settings: "passed",
      errors,
    });
    await page.close();
  }
  await fs.writeFile(
    ".impeccable/review/compact-hud.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
}
