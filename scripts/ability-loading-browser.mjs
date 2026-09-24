import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.GAME_URL ?? "http://127.0.0.1:5184/play/";

async function clickAndCheckArt(page, selector) {
  const images = await page.evaluate(async (selector) => {
    document.querySelector(selector).click();
    await new Promise(requestAnimationFrame);
    return [...document.querySelectorAll("#menu-library img")].map((img) => ({
      src: img.getAttribute("src"),
      ready: img.complete && img.naturalWidth > 0,
    }));
  }, selector);
  assert.ok(images.length > 0);
  assert.ok(images.every((img) => img.ready), JSON.stringify(images));
}

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requested = new Set();
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route("**/abilities/*.png", async (route) => {
      requested.add(new URL(route.request().url()).pathname);
      await held;
      await route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // The scene is ready, but the cold-cache icons are still in flight.
    await page.waitForFunction(() =>
      document.querySelector("#load-meter")?.getAttribute("aria-valuenow") === "90",
    );
    assert.equal(requested.size, 13, "all unique icons preload, including later pages");
    assert.equal(await page.locator("#loading").isVisible(), true);
    assert.equal(await page.locator("#intro").isVisible(), false);
    release();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(await page.locator("#loading").isVisible(), false);
    await clickAndCheckArt(page, "#menu-abilities");
    while (await page.locator('[data-page="next"]').isEnabled()) {
      await clickAndCheckArt(page, '[data-page="next"]');
    }
    for (const category of ["Weapons", "Support", "Supplies", "All"]) {
      await clickAndCheckArt(page, `[data-filter="${category}"]`);
    }
    await clickAndCheckArt(page, '[data-ability="lightning"]');
    if (viewport.width <= 700) await clickAndCheckArt(page, "#menu-back");
    await page.locator("#menu-back").click();
    await clickAndCheckArt(page, "#menu-abilities");
    assert.deepEqual(errors, []);
    await page.close();
  }

  const page = await browser.newPage();
  await page.route("**/abilities/drone_guard.png", (route) => route.abort());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  assert.equal(await page.locator("#intro").isVisible(), true);
  assert.equal(await page.locator("#loading.has-error").count(), 0);
  await page.close();
  console.log("PASS: delayed icons stay behind startup; desktop/mobile pages, filters, detail and reopen have ready art; failed icon does not block boot");
} finally {
  await browser.close();
}
