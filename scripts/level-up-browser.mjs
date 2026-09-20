// Actual production play collects the first chest and selects a level-up; no state injection.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
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
    await page.goto("http://127.0.0.1:5185");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    await page.locator("#start").click();
    const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(650);
    await page.keyboard.up("KeyD");
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().phase === "upgrade",
    );
    const up = await read();
    assert.equal(up.level, 2);
    const xp = await page.locator(".top-progress").evaluate((el) => ({
      height: el.clientHeight,
      label: el.textContent.trim(),
      width: el.clientWidth,
    }));
    assert.ok(xp.height >= 24);
    assert.ok(xp.label.includes("DP"));
    assert.equal(
      await page.locator("#xp-meter-count").textContent(),
      `${up.xp} / ${up.xpNeeded} DP`,
    );
    const upTime = up.time;
    await page.waitForTimeout(350);
    assert.equal((await read()).time, upTime);
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#upgrade img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    const fit = await page
      .locator(".upgrade-sheet")
      .evaluate(
        (el) =>
          el.scrollHeight <= el.clientHeight + 1 &&
          el.getBoundingClientRect().bottom <= innerHeight,
      );
    assert.ok(fit);
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page.locator(".upgrade-choice:focus").getAttribute("data-choice"),
      "1",
    );
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await page.locator(".upgrade-choice:focus").getAttribute("data-choice"),
      "0",
    );
    await page.screenshot({
      path: `.impeccable/review/level-up-live-${width}.png`,
    });
    const choice = up.choices[0];
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().phase === "playing",
    );
    assert.equal((await read()).upgrades[choice], up.upgrades[choice] + 1);
    const overlaps = await page.evaluate(() => {
      const b = document.querySelector(".top-progress").getBoundingClientRect();
      return [".masthead", "#timer", "#ability-loadout"].filter((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return b.bottom > r.top && b.top < r.bottom;
      });
    });
    assert.deepEqual(overlaps, []);
    await page.waitForFunction(() => {
      const s = window.__JUNK_MAGNET__.snapshot();
      return s.xp > 0 && s.phase === "playing";
    });
    await page.waitForFunction(() => {
      const s = window.__JUNK_MAGNET__.snapshot(),
        bar = document.querySelector("#xp-progress");
      return (
        Math.abs(
          bar.getBoundingClientRect().width / bar.clientWidth -
            Math.min(1, s.xp / s.xpNeeded),
        ) < 0.001
      );
    });
    const gained = await read();
    assert.equal(
      await page.locator("#xp-meter-count").textContent(),
      `${gained.xp} / ${gained.xpNeeded} DP`,
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#xp-progress").getBoundingClientRect().width >
        1,
    );
    const fill = await page
      .locator("#xp-progress")
      .evaluate((el) => getComputedStyle(el).transform);
    assert.notEqual(fill, "matrix(0, 0, 0, 1, 0, 0)");
    await page.screenshot({
      path: `.impeccable/review/xp-bar-live-${width}.png`,
    });
    await page.locator("#pause").click();
    await page.locator(".top-progress").waitFor({ state: "hidden" });
    await page.locator("#resume").click();
    await page.locator(".top-progress").waitFor({ state: "visible" });
    assert.deepEqual(errors, []);
    report.push({
      width,
      height,
      xp,
      gained: { xp: gained.xp, needed: gained.xpNeeded, fill },
      level: up.level,
      choice,
      frozen: true,
      resumed: true,
      overlaps,
      errors,
    });
    await page.close();
    console.log(`PASS real level-up ${width}x${height}`);
  }
  await fs.writeFile(
    ".impeccable/review/level-up-browser.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
