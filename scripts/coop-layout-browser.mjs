import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const language of ["en", "tr", "de", "fr", "es", "pt"]) {
    const page = await browser.newPage({
      locale: language,
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
    await page.locator("#menu-coop").waitFor({ state: "visible" });
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 568],
      [844, 390],
      [667, 375],
    ]) {
      await page.setViewportSize({ width, height });
      const nav = await page.locator("#menu-coop").boundingBox();
      assert.ok(
        nav && nav.y >= 0 && nav.y + nav.height <= height,
        `${language} ${width} menu`,
      );
      await page.locator("#menu-coop").click();
      const overflow = await page.locator(".coop-sheet").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          right: r.right,
          scroll: el.scrollHeight - el.clientHeight,
          body: document.documentElement.scrollHeight - innerHeight,
        };
      });
      assert.ok(
        overflow.top >= 0 &&
          overflow.bottom <= height + 1 &&
          overflow.right <= width + 1 &&
          overflow.scroll < 2 &&
          overflow.body < 2,
        `${language} ${width} ${JSON.stringify(overflow)}`,
      );
      reports.push({ language, width, height, overflow: false });
      await page.locator("#coop-lobby [data-coop=back]").click();
    }
    await page.close();
  }
  await fs.writeFile(
    ".impeccable/review/coop/layouts.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(`${reports.length} localized co-op/menu layouts passed`);
} finally {
  await browser.close();
}
