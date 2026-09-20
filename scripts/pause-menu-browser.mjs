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
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    await page.locator("#start").click();
    await page.waitForTimeout(200);
    await page.locator("#pause").click();
    const before = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    assert.equal(
      await page.locator("#modal-title").innerText(),
      "DURAKLATILDI",
    );
    assert.equal(
      await page.locator("#pause-level").innerText(),
      String(before.level),
    );
    assert.equal(
      await page.locator("#pause-kills").innerText(),
      String(before.kills),
    );
    for (let lang = 0; lang < 6; lang++) {
      const issues = await page.evaluate(() => {
        const root = document.querySelector("#modal .modal-card");
        const result = [];
        if (
          root.scrollHeight > root.clientHeight + 2 ||
          root.scrollWidth > root.clientWidth + 2
        )
          result.push("panel overflow");
        const parent = root.getBoundingClientRect();
        for (const el of root.querySelectorAll(
          "button,h2,p,.pause-summary,button span",
        )) {
          if (!el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          if (
            r.left < 0 ||
            r.top < 0 ||
            r.right > innerWidth + 1 ||
            r.bottom > innerHeight + 1
          )
            result.push(`${el.id || el.tagName} offscreen`);
          if (r.bottom > parent.bottom + 1 || r.right > parent.right + 1)
            result.push(`${el.id || el.tagName} outside card`);
        }
        return result;
      });
      if (issues.length)
        await page.screenshot({ path: ".impeccable/review/pause-failure.png" });
      assert.deepEqual(issues, [], `${width}x${height} language ${lang}`);
      assert.equal(
        await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time),
        before.time,
      );
      if (lang === 0)
        await page.screenshot({
          path: `.impeccable/review/pause-redesign-${width}x${height}.png`,
        });
      await page.locator("#language").click();
    }
    await page.locator("#help").click();
    assert.equal(await page.locator(".pause-summary").isVisible(), false);
    assert.equal(
      await page.locator("#help-content .help-illustration:visible").count(),
      1,
    );
    await page.locator("#resume").click();
    assert.equal(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().phase),
      "playing",
    );
    await page.locator("#pause").click();
    await page.locator("#pause-menu").click();
    assert.ok(await page.locator("#start").isVisible());
    await page.locator("#start").click();
    await page.locator("#pause").click();
    await page.locator("#restart").click();
    assert.equal(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().hp),
      100,
    );
    assert.ok(
      (await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time)) < 1,
    );
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      languages: 6,
      overflow: false,
      resume: true,
      restart: true,
      help: true,
      errors,
    });
    await page.close();
    console.log(`PASS ${width}x${height}`);
  }
  await fs.writeFile(
    ".impeccable/review/pause-redesign.json",
    JSON.stringify(reports, null, 2),
  );
} finally {
  await browser.close();
}
