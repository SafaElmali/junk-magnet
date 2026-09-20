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
      isMobile: mobile,
      hasTouch: mobile,
      locale: "tr-TR",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const state = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    assert.equal((await state()).phase, "ready");
    assert.equal(await page.locator("#start").innerText(), "OYNA\n▶");
    await page.screenshot({ path: `.impeccable/review/menu-${width}.png` });
    assert.equal(
      await page
        .locator("#intro")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
      true,
    );
    await page.locator("#menu-abilities").click();
    assert.equal(await page.locator("#menu-library article").count(), 10);
    await page.keyboard.press("Space");
    assert.equal(
      (await state()).phase,
      "ready",
      "Space must not launch from a subpage",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator("#menu-abilities")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.locator("#menu-settings").click();
    await page.locator("#menu-sound").click();
    assert.equal(
      await page.locator("#menu-sound").getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#menu-language").click();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(
      await page.locator("#menu-panel-title").innerText(),
      "SETTINGS",
    );
    await page.locator("#menu-language").click();
    await page.locator("#menu-back").click();
    await page.locator("#menu-help").click();
    assert.match(await page.locator("#help-content").innerText(), /otomatik/);
    await page.locator("#resume").click();
    assert.equal((await state()).phase, "ready");
    await page.locator("#start").click();
    await page.waitForTimeout(350);
    assert.equal((await state()).phase, "playing");
    await page.locator("#pause").click();
    const paused = await state();
    await page.locator("#pause-menu").click();
    assert.equal(await page.locator("#start-label").innerText(), "DEVAM ET");
    await page.waitForTimeout(300);
    assert.equal((await state()).time, paused.time);
    await page.locator("#menu-help").click();
    await page.locator("#resume").click();
    assert.equal((await state()).phase, "paused");
    await page.locator("#start").click();
    await page.waitForTimeout(150);
    assert.ok((await state()).time > paused.time);
    await page.locator("#pause").click();
    await page.locator("#pause-menu").click();
    await page.locator("#new-run").click();
    assert.ok((await state()).time < 0.3);
    assert.equal((await state()).level, 1);
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      mobile,
      menu: true,
      settings: true,
      abilities: 10,
      resume: true,
      newRun: true,
      errors,
    });
    await page.close();
  }
  await fs.writeFile(
    ".impeccable/review/menu.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
}
