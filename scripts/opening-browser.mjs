import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [568, 320],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      locale: "tr-TR",
      hasTouch: width < 900,
      isMobile: width < 900,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    const ready = await read();
    assert.equal(ready.scrap, 0);
    assert.equal(ready.pickups, 6);
    assert.equal(ready.openingRemaining, 3);
    await page.locator("#start").click();
    await page.locator("#opening-guide").waitFor({ state: "visible" });
    const initial = await read();
    assert.ok(await page.locator("#opening-guide").isVisible());
    const hintFits = await page.locator("#opening-guide").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        el.scrollWidth <= el.clientWidth + 1
      );
    });
    assert.ok(hintFits);
    assert.equal(initial.launched, 0);
    assert.equal(initial.hp, 100);
    assert.equal(initial.shots, 0);
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `.impeccable/review/opening-ground-${width}.png`,
    });
    await page.locator("#pause").click();
    const paused = await read();
    assert.equal(await page.locator("#opening-guide").isVisible(), false);
    await page.waitForTimeout(200);
    assert.equal((await read()).openingRemaining, paused.openingRemaining);
    assert.deepEqual((await read()).enemies, paused.enemies);
    await page.locator("#resume").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().scrap === 6,
    );
    const gathered = await read();
    assert.ok(gathered.openingRemaining > 0);
    assert.equal(gathered.launched, 0);
    assert.equal(gathered.pickups, 0);
    await page
      .locator('#opening-guide[data-step="orbit"]')
      .waitFor({ state: "visible" });
    await page.screenshot({
      path: `.impeccable/review/opening-orbit-${width}.png`,
    });
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().launched > 0,
    );
    const attack = await read();
    assert.equal(attack.openingRemaining, 0);
    for (let i = 0; i < 160 && (await read()).time < 7.2; i++) {
      if ((await read()).phase === "upgrade")
        await page.locator(".upgrade-choice").first().click();
      await page.waitForTimeout(80);
    }
    assert.ok((await read()).time >= 7.2);
    assert.equal(await page.locator("#opening-guide").isVisible(), false);
    await page.locator("#pause").click();
    await page.locator("#restart").click();
    assert.ok((await read()).openingRemaining > 2);
    assert.equal((await read()).launched, 0);
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      ready: { scrap: ready.scrap, pickups: ready.pickups },
      gathered: {
        time: gathered.time,
        openingRemaining: gathered.openingRemaining,
        scrap: gathered.scrap,
      },
      firstAttackTime: attack.time,
      pauseFreezes: true,
      restartReplays: true,
      errors,
    });
    await page.close();
    console.log(`PASS opening ${width}x${height}`);
  }
  await fs.writeFile(
    ".impeccable/review/opening-browser.json",
    JSON.stringify(reports, null, 2),
  );
} finally {
  await browser.close();
}
