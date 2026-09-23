import { chooseMenuLanguage } from "./language-controls.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [1024, 600],
    [390, 844],
    [320, 740],
    [375, 667],
    [320, 568],
    [844, 390],
    [568, 320],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      locale: "tr-TR",
      isMobile: width < 900,
      hasTouch: width < 900,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const check = async (label) => {
      const violations = await page.evaluate(() => {
        const visible = (e) =>
          e.getClientRects().length &&
          getComputedStyle(e).visibility !== "hidden";
        const roots = [
          ".menu-shell",
          ".menu-panel",
          "#menu-library",
          ".ability-grid",
          ".ability-detail",
          ".modal-card",
        ];
        const result = [];
        for (const selector of roots)
          for (const el of document.querySelectorAll(selector))
            if (visible(el)) {
              if (
                el.scrollHeight > el.clientHeight + 2 ||
                el.scrollWidth > el.clientWidth + 2
              )
                result.push(
                  `${selector} overflow ${el.scrollWidth}x${el.scrollHeight} vs ${el.clientWidth}x${el.clientHeight}`,
                );
            }
        for (const el of document.querySelectorAll(
          "#intro button,#intro h3,#intro h4,#intro p,#intro .detail-meta,#intro .detail-acquisition,#modal button,#modal dd",
        ))
          if (visible(el)) {
            const r = el.getBoundingClientRect();
            if (
              r.x < -1 ||
              r.y < -1 ||
              r.right > innerWidth + 1 ||
              r.bottom > innerHeight + 1
            )
              result.push(
                `${el.id || el.className || el.tagName} offscreen ${JSON.stringify({ x: r.x, y: r.y, right: r.right, bottom: r.bottom })}`,
              );
          }
        return result;
      });
      assert.deepEqual(violations, [], `${width}x${height} ${label}`);
    };
    const shot = async (kind) =>
      page.screenshot({
        path: `.impeccable/review/fixed-${kind}-${width}x${height}.png`,
      });
    await check("home");
    await shot("home");
    assert.equal(await page.locator("#start svg").count(), 1);
    await page.locator("#menu-abilities").click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ability-grid img")].every(
        (i) => i.complete && i.naturalWidth,
      ),
    );
    await check("gallery");
    await shot("abilities");
    const seen = new Set();
    const compact = width <= 700 || height <= 550;
    while (true) {
      const ids = await page
        .locator(".ability-tile")
        .evaluateAll((els) => els.map((el) => el.dataset.ability));
      for (const id of ids) {
        seen.add(id);
        await page.locator(`[data-ability="${id}"]`).click();
        await check(`detail ${id}`);
        if (id === "lightning") await shot("detail");
        if (compact) {
          await page.locator("#menu-back").click();
          await check("back to gallery");
        }
      }
      if (await page.locator('[data-page="next"]').isDisabled()) break;
      await page.locator('[data-page="next"]').click();
      await check("next page");
    }
    assert.equal(seen.size, 13);
    for (const category of ["Weapons", "Support", "Supplies", "All"]) {
      await page.locator(`[data-filter="${category}"]`).click();
      await check(category);
    }
    if (width === 390) {
      await page.setViewportSize({ width: 568, height: 320 });
      await page.waitForTimeout(100);
      await check("rotated to landscape");
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      await check("rotated to portrait");
    }
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(80);
    assert.equal(
      await page.locator("#intro").evaluate((el) => el.scrollTop),
      0,
    );
    await page.locator("#menu-back").click();
    await page.locator("#menu-help").click();
    for (let i = 0; i < 5; i++) {
      await check(`Turkish help ${i + 1}`);
      if (i < 4) await page.locator("#help-next").click();
    }
    await page.locator("#resume").click();
    await page.locator("#menu-settings").click();
    await check("settings Turkish");
    await chooseMenuLanguage(page, "en");
    await check("settings English");
    await page.locator("#menu-back").click();
    await check("home English");
    await page.locator("#menu-help").click();
    for (let i = 0; i < 5; i++) {
      await check(`help ${i + 1}`);
      if (i === 3) await shot("help");
      if (i < 4) await page.locator("#help-next").click();
    }
    await page.locator("#resume").click();
    await page.locator("#start").click();
    await page.waitForTimeout(200);
    await page.locator("#pause").click();
    await check("pause");
    await page.locator("#pause-menu").click();
    await check("resumable home");
    const before = await page.evaluate(
      () => window.__JUNK_MAGNET__.snapshot().time,
    );
    await page.locator("#menu-help").click();
    await check("help while paused");
    await page.locator("#resume").click();
    assert.equal(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time),
      before,
    );
    await page.locator("#start").click();
    await page.waitForTimeout(120);
    assert.ok(
      (await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time)) >
        before,
    );
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      abilities: seen.size,
      noOverflow: true,
      noScroll: true,
      helpSteps: 5,
      settings: true,
      resume: true,
      errors,
    });
    await page.close();
    console.log(`PASS ${width}x${height}`);
  }
  await fs.writeFile(
    ".impeccable/review/fixed-menus.json",
    JSON.stringify(reports, null, 2),
  );
} finally {
  await browser.close();
}
