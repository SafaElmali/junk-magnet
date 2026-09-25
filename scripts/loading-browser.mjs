// Actual boot requests are held/failed; no injected screen or fabricated progress.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.GAME_URL ?? "http://127.0.0.1:5185/play/";
const report = [];
const sizes = [
  [1440, 900],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
];
const output = process.env.OUTPUT_DIR ?? ".impeccable/review";
await fs.mkdir(output, { recursive: true });
async function checkLayout(page) {
  const data = await page.evaluate(() => {
    const visible = [
      ".loading-brand",
      ".loading-stage",
      ".loading-copy",
      ".loading-meter",
      ".loading-tip",
      "#reload",
    ]
      .map((s) => document.querySelector(s))
      .filter((e) => e.getBoundingClientRect().height > 0);
    return {
      overflow:
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight,
      clipped: visible
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.x < -1 ||
            r.y < -1 ||
            r.right > innerWidth + 1 ||
            r.bottom > innerHeight + 1
          );
        })
        .map((e) => e.className),
      percent: document
        .querySelector("#load-meter")
        .getAttribute("aria-valuenow"),
      title: document.querySelector("#load-title").textContent,
    };
  });
  assert.equal(data.overflow, false);
  assert.deepEqual(data.clipped, []);
  return data;
}
try {
  // A cold visit must show the loader before any game JavaScript executes.
  const coldPage = await browser.newPage();
  let releaseScripts;
  const scriptsHeld = new Promise((resolve) => (releaseScripts = resolve));
  await coldPage.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") await scriptsHeld;
    await route.continue();
  });
  await coldPage.goto(url, { waitUntil: "commit" });
  await coldPage.locator("#loading").waitFor();
  assert.equal(await coldPage.locator(".game-intro").isVisible(), false);
  assert.equal(await coldPage.locator("#reload").isVisible(), false);
  for (const [width, height] of sizes) {
    await coldPage.setViewportSize({ width, height });
    const data = await checkLayout(coldPage);
    assert.equal(data.percent, "0");
    report.push({ mode: "before-javascript", width, height, ...data });
  }
  await coldPage.screenshot({ path: `${output}/loading-before-javascript.png` });
  releaseScripts();
  await coldPage.waitForFunction(() => window.__JUNK_MAGNET__);
  assert.equal(await coldPage.locator("#intro").isVisible(), true);
  assert.equal(await coldPage.locator("#loading").count(), 1);
  assert.equal(await coldPage.locator("#loading").isVisible(), false);
  await coldPage.close();

  const noScriptPage = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await noScriptPage.goto(url);
  assert.equal(await noScriptPage.locator("#loading").isVisible(), false);
  assert.equal(await noScriptPage.locator(".game-intro").isVisible(), true);
  assert.equal(await noScriptPage.locator('a[href="/guide/"]').isVisible(), true);
  assert.equal(await noScriptPage.locator("#app").evaluate((el) => getComputedStyle(el).overflow), "auto");
  await noScriptPage.close();

  for (const code of ["tr", "en", "de", "fr", "es", "pt"]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      locale: code,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route("**/models/robot.glb", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => {
      const progress = Number(
        document.querySelector("#load-meter")?.getAttribute("aria-valuenow"),
      );
      return progress > 0 && progress < 90;
    });
    const first = await page
      .locator(".loading-orbit")
      .evaluate((e) => getComputedStyle(e).transform);
    await page.waitForTimeout(160);
    const second = await page
      .locator(".loading-orbit")
      .evaluate((e) => getComputedStyle(e).transform);
    assert.notEqual(first, second);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const data = await checkLayout(page);
      report.push({ mode: "held-real-load", code, width, height, ...data });
      if (code === "tr")
        await page.screenshot({
          path: `${output}/loading-${width}x${height}.png`,
        });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const motion = await page
      .locator(".loading-orbit,.loading-robot,.loading-eyes")
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).animationName));
    assert.deepEqual(motion, ["none", "none", "none"]);
    assert.equal(
      await page
        .locator("#load-progress")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    release();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(await page.locator("#loading").isVisible(), false);
    assert.equal(await page.locator("#intro").isVisible(), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  for (const code of ["tr", "en", "de", "fr", "es", "pt"]) {
    const page = await browser.newPage({
      viewport: { width: 568, height: 320 },
      locale: code,
    });
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route("**/models/robot.glb", (route) => route.abort());
    await page.route("**/models/scrap-nut.glb", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#loading.has-error").waitFor();
    const copy = await page.locator("#load-detail").textContent();
    release();
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#load-detail").textContent(), copy);
    assert.equal(await page.locator(".loading-meter").isVisible(), false);
    assert.equal(await page.locator("#reload").isVisible(), true);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      report.push({
        mode: "failed-real-load",
        code,
        width,
        height,
        ...(await checkLayout(page)),
      });
      if (code === "tr" && width === 568)
        await page.screenshot({
          path: `${output}/loading-error-landscape.png`,
        });
    }
    await page.unroute("**/models/robot.glb");
    await page.locator("#reload").click();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(await page.locator("#intro").isVisible(), true);
    await page.close();
  }
  await fs.writeFile(
    `${output}/loading-browser.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    `PASS ${report.length} actual loading/error layouts; animation, reduced motion, completion and retry in six languages`,
  );
} finally {
  await browser.close();
}
