// Explicit layout-only fixture: force the actual HUD visible with a full loadout.
// Boss combat itself is verified in expansion.test.ts and expansion-renderer.mjs.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
try {
  const page = await browser.newPage({ locale: "tr-TR" });
  await page.goto("http://127.0.0.1:5185");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator("#start").click();
  await page.locator("#pause").click();
  await page.addStyleTag({
    content:
      "#boss-hud.hidden{display:block!important}.ability-loadout{visibility:visible!important}#modal{display:none!important}",
  });
  await page.evaluate(() => {
    const loadout = document.querySelector("#ability-loadout");
    const chip = loadout.firstElementChild;
    while (loadout.children.length < 7) loadout.append(chip.cloneNode(true));
    document.querySelector("#boss-name").textContent = "Hurdalık Devi";
    document.querySelector("#boss-fill").style.transform = "scaleX(.7)";
  });
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
    [568, 320],
  ]) {
    await page.setViewportSize({ width, height });
    const result = await page.evaluate(() => {
      const b = document.querySelector("#boss-hud").getBoundingClientRect();
      const overlaps = ["#ability-loadout", "#timer", ".masthead"].filter(
        (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return (
            b.left < r.right &&
            b.right > r.left &&
            b.top < r.bottom &&
            b.bottom > r.top
          );
        },
      );
      return {
        overlaps,
        inside:
          b.x >= 0 &&
          b.y >= 0 &&
          b.right <= innerWidth &&
          b.bottom <= innerHeight,
      };
    });
    assert.deepEqual(result.overlaps, [], `${width}x${height}`);
    assert.equal(result.inside, true);
    report.push({ fixture: true, width, height, ...result });
  }
  await fs.writeFile(
    ".impeccable/review/boss-hud-layout.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS five boss HUD layouts, full loadout and toolbar without overlap",
  );
} finally {
  await browser.close();
}
