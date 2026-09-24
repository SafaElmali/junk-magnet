import { chooseMenuLanguage } from "./language-controls.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
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
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185/play/");
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const compact = width <= 700 || height <= 550;
    const capacity = !compact ? 10 : height <= 420 ? 4 : width <= 360 ? 4 : 6;
    async function selectAbility(id) {
      if (
        compact &&
        (await page.locator("#menu-library").getAttribute("data-view")) ===
          "detail"
      )
        await page.locator("#menu-back").click();
      await page.locator('[data-filter="All"]').click();
      while (!(await page.locator(`[data-ability="${id}"]`).count()))
        await page.locator('[data-page="next"]').click();
      await page.locator(`[data-ability="${id}"]`).click();
    }
    const before = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    await page.locator("#menu-abilities").click();
    assert.equal(await page.locator(".ability-tile").count(), capacity);
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#menu-library img")].every(
        (img) => img.complete && img.naturalWidth === 384,
      ),
    );
    assert.equal(
      await page
        .locator("#intro")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/abilities-${width}.png`,
    });
    for (const [category, count] of [
      ["Weapons", 4],
      ["Support", 6],
      ["Supplies", 3],
      ["All", 13],
    ]) {
      await page.locator(`[data-filter="${category}"]`).click();
      assert.equal(
        await page.locator(".ability-tile").count(),
        Math.min(count, capacity),
      );
    }
    for (const id of [
      "lightning",
      "turret",
      "burst",
      "boots",
      "magnet",
      "armor",
      "repair",
      "refill",
      "overclock",
      "drone_collector",
      "drone_repair",
      "drone_guard",
      "saw",
    ]) {
      await selectAbility(id);
      assert.equal(
        await page
          .locator(`[data-ability="${id}"]`)
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page.locator("#ability-detail img").getAttribute("src"),
        `./abilities/${id}.png`,
      );
      assert.ok(
        (await page.locator("#ability-detail p").innerText()).length > 30,
      );
    }
    await selectAbility("overclock");
    assert.equal(await page.locator(".detail-meta strong svg").count(), 1);
    assert.match(await page.locator(".detail-meta span").innerText(), /TEKRAR/);
    assert.deepEqual(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().upgrades),
      before.upgrades,
    );
    assert.equal(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time),
      0,
    );
    if (compact) await page.locator("#menu-back").click();
    await page.locator("#menu-back").click();
    await page.locator("#menu-settings").click();
    await chooseMenuLanguage(page, "en");
    await page.locator("#menu-back").click();
    await page.locator("#menu-abilities").click();
    await selectAbility("overclock");
    assert.equal(
      await page.locator("#ability-detail-name").innerText(),
      "Overclock",
    );
    assert.match(
      await page.locator("#ability-detail p").innerText(),
      /20 seconds/,
    );
    if (compact) await page.locator("#menu-back").click();
    await page.locator("#menu-back").click();
    await page.locator("#start").click();
    if (!mobile) {
      await page.waitForFunction(
        () => window.__JUNK_MAGNET__.snapshot().phase === "upgrade",
        null,
        { timeout: 40000 },
      );
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".upgrade-icon img")].every(
          (img) => img.complete && img.naturalWidth === 384,
        ),
      );
      assert.equal(await page.locator(".upgrade-icon img").count(), 3);
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(viewport);
        await page.screenshot({
          path: `.impeccable/review/ability-upgrade-${viewport.width}.png`,
        });
        if (viewport.height > 500)
          assert.ok(
            await page
              .locator("#upgrade-choices button")
              .evaluateAll((buttons) =>
                buttons.every(
                  (button) =>
                    button.querySelector("img").getBoundingClientRect().right <=
                    button
                      .querySelector(".upgrade-text")
                      .getBoundingClientRect().left,
                ),
              ),
          );
      }
      await page.waitForTimeout(300);
      await page.locator("#upgrade-choices button").first().click();
      assert.equal(
        await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().phase),
        "playing",
      );
    }
    assert.deepEqual(errors, []);
    results.push({
      width,
      height,
      mobile,
      assets: 10,
      filters: true,
      localized: true,
      readOnly: true,
      errors,
    });
    await page.close();
  }
  await fs.writeFile(
    ".impeccable/review/abilities.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
