import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.GAME_URL ?? "http://127.0.0.1:5185";
const reports = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      locale: "tr-TR",
      isMobile: mobile,
      hasTouch: mobile,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    assert.equal(await page.locator("html").getAttribute("lang"), "tr");
    assert.match(await page.locator("#start").innerText(), /OYNA/);
    await page.locator("#menu-help").click();
    for (let step = 0; step < 3; step++)
      await page.locator("#help-next").click();
    assert.match(
      await page.locator("#help-content").innerText(),
      /Mavi enerji topla/,
    );
    await page.locator("#resume").click();
    await page.locator("#menu-settings").click();
    await page.locator("#menu-language").click();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await page.reload();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(
      await page.locator("html").getAttribute("lang"),
      "en",
      "Saved choice persists over Turkish browser locale",
    );
    await page.locator("#menu-settings").click();
    await page.locator("#menu-language").click();
    await page.locator("#menu-back").click();
    await page.locator("#start").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().phase === "upgrade",
      null,
      { timeout: 40000 },
    );
    const paused = await read();
    const tr = await page.locator("#upgrade-choices").innerText();
    const pickedName = await page
      .locator("#upgrade-choices button strong")
      .first()
      .innerText();
    assert.equal(await page.locator("#upgrade-choices button").count(), 3);
    await page.locator("#language").click();
    assert.notEqual(await page.locator("#upgrade-choices").innerText(), tr);
    const en = await read();
    assert.equal(en.time, paused.time);
    assert.deepEqual(en.choices, paused.choices);
    assert.deepEqual(en.upgrades, paused.upgrades);
    await page.locator("#language").click();
    await page.waitForTimeout(300);
    if (mobile) {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
        { width: 320, height: 740 },
      ]) {
        await page.setViewportSize(viewport);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        const sizes = await page
          .locator(".masthead button:visible")
          .evaluateAll((b) =>
            b.map((e) => ({
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            })),
          );
        assert.ok(sizes.every((s) => s.width >= 48 && s.height >= 48));
        await page.screenshot({
          path: `.impeccable/review/turkish-${viewport.width}.png`,
        });
      }
    } else
      await page.screenshot({ path: ".impeccable/review/turkish-desktop.png" });
    await page.locator("#upgrade-choices button").first().click();
    assert.equal((await read()).phase, "playing");
    assert.ok(
      (await page.locator("#ability-loadout").innerHTML()).includes(pickedName),
    );
    assert.deepEqual(errors, []);
    reports.push({
      mobile,
      language: "tr",
      persistence: true,
      upgradeSwitchPreservedRun: true,
      errors,
    });
    await page.close();
  }
  await fs.writeFile(
    ".impeccable/review/language-browser.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
}
