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
        launch: rect("#launch"),
        health: rect(".health-track"),
        timerFont: getComputedStyle(document.querySelector("#timer")).fontSize,
        visibleControls: [...document.querySelectorAll(".masthead button")]
          .filter((b) => b.getBoundingClientRect().width)
          .map((b) => b.id),
        footer: getComputedStyle(document.querySelector(".workbench")).display,
        hint: getComputedStyle(document.querySelector("#hint")).display,
      };
    });
    assert.equal(layout.yard.width, width);
    assert.equal(layout.yard.height, height);
    assert.deepEqual(layout.visibleControls, ["pause"]);
    assert.equal(layout.footer, "none");
    assert.equal(layout.hint, "none");
    assert.ok(parseFloat(layout.timerFont) <= 22);
    assert.ok(layout.launch.width >= 48 && layout.launch.width <= 64);
    assert.ok(layout.health.width <= 60 && layout.health.height <= 7);
    await page.screenshot({
      path: `.impeccable/review/compact-hud-${width}.png`,
    });
    await page.locator("#pause").click();
    await page.locator("#language").click();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await page.locator("#language").click();
    await page.locator("#help").click();
    assert.match(
      await page.locator("#help-content").innerText(),
      /Mavi enerji/,
    );
    await page.locator("#resume").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().phase === "upgrade",
      null,
      { timeout: 20000 },
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
