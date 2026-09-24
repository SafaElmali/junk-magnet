import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
const url = process.env.GAME_URL ?? "http://127.0.0.1:5185/play/";
const directory = ".impeccable/review";
await fs.mkdir(directory, { recursive: true });
async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const visible = (e) =>
      e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
    const issues = [];
    for (const e of document.querySelectorAll(
      ".menu-shell,.menu-panel,#menu-options,#menu-language-picker,#menu-quality-picker,.modal-card,.ability-grid,.ability-detail",
    )) {
      if (!visible(e)) continue;
      if (
        e.scrollHeight > e.clientHeight + 2 ||
        e.scrollWidth > e.clientWidth + 2
      )
        issues.push(
          `${e.id || e.className}: ${e.scrollWidth}x${e.scrollHeight} / ${e.clientWidth}x${e.clientHeight}`,
        );
    }
    for (const e of document.querySelectorAll(
      "#intro button,#intro .menu-choice strong,#intro .menu-choice small,#intro h3,#intro h4,#intro p,#modal button,#modal dd,#modal .help-illustration",
    )) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (
        r.left < -1 ||
        r.top < -1 ||
        r.right > innerWidth + 1 ||
        r.bottom > innerHeight + 1
      )
        issues.push(`${e.id || e.className || e.tagName} outside viewport`);
    }
    return issues;
  });
  if (issues.length)
    await page.screenshot({ path: `${directory}/features-layout-failure.png` });
  assert.deepEqual(issues, [], label);
}
async function backToHome(page) {
  for (let i = 0; i < 4 && !(await page.locator("#menu-home").isVisible()); i++)
    await page.locator("#menu-back").click();
  assert.ok(await page.locator("#menu-home").isVisible());
}
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
      deviceScaleFactor: width > 900 ? 2 : 1,
      isMobile: width < 900,
      hasTouch: width < 900,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const initial = await page.evaluate(
      () => window.__JUNK_MAGNET__.snapshot().world.graphics,
    );
    for (const code of ["en", "tr", "de", "fr", "es", "pt"]) {
      await page.locator("#menu-settings").click();
      await page.locator("#menu-language").click();
      assert.equal(await page.locator("[data-language] svg").count(), 6);
      await bounds(page, `${width}x${height} language picker`);
      await page.locator(`[data-language="${code}"]`).click();
      assert.equal(await page.locator("html").getAttribute("lang"), code);
      await bounds(page, `${width}x${height} ${code} settings`);
      await backToHome(page);
      await bounds(page, `${width}x${height} ${code} home`);
      assert.equal(await page.locator("#menu-abilities svg").count(), 1);
      assert.equal(await page.locator("#menu-settings svg").count(), 1);
      assert.equal(await page.locator("#menu-help svg").count(), 1);
      await page.locator("#menu-abilities").click();
      assert.equal(await page.locator("[data-filter] svg").count(), 4);
      await bounds(page, `${width}x${height} ${code} abilities`);
      for (const ability of ["lightning", "turret", "burst"]) {
        await page.locator('[data-filter="Weapons"]').click();
        if (!(await page.locator(`[data-ability="${ability}"]`).count()))
          await page.locator('[data-page="next"]').click();
        await page.locator(`[data-ability="${ability}"]`).click();
        await bounds(page, `${width}x${height} ${code} detail ${ability}`);
        if (width <= 700 || height <= 550)
          await page.locator("#menu-back").click();
      }
      await backToHome(page);
      await page.locator("#menu-help").click();
      for (let step = 0; step < 5; step++) {
        await bounds(page, `${width}x${height} ${code} help ${step}`);
        assert.equal(
          await page
            .locator(
              "#help-content dl > div:not(.hidden) .help-illustration svg",
            )
            .count(),
          1,
        );
        if (code === "tr" && step === 2)
          await page.screenshot({
            path: `${directory}/features-help-${width}x${height}.png`,
          });
        if (step < 4) await page.locator("#help-next").click();
      }
      await page.locator("#resume").click();
    }
    await page.locator("#menu-settings").click();
    for (const quality of ["performance", "balanced", "high", "ultra"]) {
      await page.locator("#menu-quality").click();
      await bounds(page, `${width}x${height} quality picker`);
      await page.locator(`[data-quality="${quality}"]`).click();
      const graphics = await page.evaluate(
        () => window.__JUNK_MAGNET__.snapshot().world.graphics,
      );
      assert.equal(graphics.quality, quality);
      assert.ok(graphics.width > 0 && graphics.height > 0);
      report.push({ width, height, quality, graphics });
      if (await page.locator("#menu-quality-picker").isVisible())
        await page.locator("#menu-back").click();
    }
    await page.screenshot({
      path: `${directory}/features-settings-${width}x${height}.png`,
    });
    await backToHome(page);
    await page.locator("#start").click();
    await page.waitForTimeout(150);
    await page.locator("#pause").click();
    await page.locator("#pause-menu").click();
    await bounds(page, `${width}x${height} resumable home`);
    const frozenTime = await page.evaluate(
      () => window.__JUNK_MAGNET__.snapshot().time,
    );
    await page.locator("#menu-settings").click();
    await page.locator("#menu-quality").click();
    await page.locator('[data-quality="ultra"]').click();
    await backToHome(page);
    assert.equal(
      await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time),
      frozenTime,
    );
    await page.locator("#start").click();
    await page.waitForTimeout(150);
    assert.ok(
      (await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time)) >
        frozenTime,
    );
    await page.reload();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(await page.locator("html").getAttribute("lang"), "pt");
    assert.equal(
      await page.evaluate(
        () => window.__JUNK_MAGNET__.snapshot().world.graphics.quality,
      ),
      "ultra",
    );
    assert.deepEqual(errors, []);
    report.push({
      width,
      height,
      languages: 6,
      helpSteps: 30,
      initial,
      status: "passed",
    });
    await page.close();
    console.log(
      `PASS ${width}x${height}: six languages, illustrated help, icons, live quality, persistence`,
    );
  }
  await fs.writeFile(
    `${directory}/features-browser.json`,
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
