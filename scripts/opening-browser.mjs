// Real production gameplay: the collection guide must never freeze combat.
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
    const assertApproaching = (s) => {
      assert.equal(s.enemies.length, ready.enemies.length);
      s.enemies.forEach((e, i) =>
        assert.ok(
          Math.hypot(e.x, e.z) <
            Math.hypot(ready.enemies[i].x, ready.enemies[i].z),
          "Enemy moves before collection introduction finishes",
        ),
      );
    };
    await page.locator("#start").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().time >= 0.25,
    );
    const immediate = await read();
    assert.ok(immediate.time < 1);
    assertApproaching(immediate);
    assert.ok(await page.locator("#opening-guide").isVisible());
    await page.screenshot({
      path: `.impeccable/review/immediate-start-${width}.png`,
    });
    await page.locator("#pause").click();
    const paused = await read();
    await page.waitForTimeout(200);
    assert.equal((await read()).time, paused.time);
    assert.deepEqual((await read()).enemies, paused.enemies);
    await page.locator("#resume").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().launched > 0,
    );
    const attack = await read();
    assert.ok(
      attack.time < 3,
      `No protected three-second opening: ${attack.time}`,
    );
    await page.locator("#pause").click();
    await page.locator("#restart").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().time >= 0.25,
    );
    const restarted = await read();
    assert.ok(restarted.time < 1);
    assertApproaching(restarted);
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      firstMovementTime: immediate.time,
      firstAttackTime: attack.time,
      pauseFreezes: true,
      restartImmediate: true,
      errors,
    });
    await page.close();
    console.log(`PASS immediate start ${width}x${height}`);
  }
  await fs.writeFile(
    ".impeccable/review/immediate-start.json",
    JSON.stringify(reports, null, 2),
  );
} finally {
  await browser.close();
}
