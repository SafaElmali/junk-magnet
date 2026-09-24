import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5184/play/");
await page.waitForFunction(() => window.__JUNK_MAGNET__);
await page.locator("#menu-help").click();
await page.locator("#resume").click();
await page.locator("#menu-help").click();
await page.locator("#resume").click();
assert.equal(
  await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().phase),
  "ready",
);
assert.equal(await page.locator("#intro").isVisible(), true);
assert.equal(await page.locator("#lower-hud").count(), 0);
await page.locator("#start").click();
await page.keyboard.down("KeyD");
await page.waitForTimeout(200);
await page.keyboard.down("KeyW");
await page.waitForTimeout(200);
await page.keyboard.up("KeyD");
await page.waitForTimeout(200);
await page.keyboard.up("KeyW");
const facing = await page.evaluate(
  () => window.__JUNK_MAGNET__.snapshot().facing,
);
assert.ok(
  Math.abs(facing.x) < 0.01 && facing.z < -0.99,
  "Robot faces movement",
);
await page.waitForFunction(
  () => window.__JUNK_MAGNET__.snapshot().launched > 0,
);
const autoAim = await page.evaluate(
  () => window.__JUNK_MAGNET__.snapshot().aim,
);
await page.mouse.move(1000, 450);
await page.waitForTimeout(50);
assert.deepEqual(
  await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().aim),
  autoAim,
  "Pointer does not override automatic targeting",
);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const t = [];
      function frame(n) {
        t.push(n);
        if (t.length < 90) requestAnimationFrame(frame);
        else resolve(89000 / (t.at(-1) - t[0]));
      }
      requestAnimationFrame(frame);
    }),
);
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
mobile.on("pageerror", (e) => errors.push(e.message));
await mobile.goto("http://127.0.0.1:5184/play/");
await mobile.waitForFunction(() => window.__JUNK_MAGNET__);
await mobile.locator("#start").tap();
await mobile.waitForTimeout(150);
const sizes = await mobile
  .locator(".masthead button:visible")
  .evaluateAll((btns) =>
    btns.map((b) => ({
      width: b.getBoundingClientRect().width,
      height: b.getBoundingClientRect().height,
    })),
  );
assert.ok(
  sizes.every((s) => s.width >= 48 && s.height >= 48),
  "Touch targets at least 48px",
);
const r = await mobile.locator("#touch-stick").boundingBox();
const x = r.x + r.width / 2,
  y = r.y + r.height / 2;
const cdp = await mobile.context().newCDPSession(mobile);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x, y, id: 1 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: x + 35, y, id: 1 }],
});
await mobile.waitForTimeout(650);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
const moved = await mobile.evaluate(() => window.__JUNK_MAGNET__.snapshot());
assert.ok(moved.player.x > 1, "Touch stick moves robot");
assert.equal(await mobile.locator("#launch").count(), 0);
await mobile.waitForFunction(
  () => window.__JUNK_MAGNET__.snapshot().launched > 0,
);
const launched = await mobile.evaluate(() => window.__JUNK_MAGNET__.snapshot());
assert.ok(launched.launched > 0, "Automatically attacks on touch devices");
await mobile.setViewportSize({ width: 844, height: 390 });
await mobile.waitForTimeout(200);
const landscapeSizes = await mobile
  .locator(".masthead button:visible")
  .evaluateAll((btns) => btns.map((b) => b.getBoundingClientRect().height));
assert.ok(landscapeSizes.every((h) => h >= 48));
assert.deepEqual(errors, []);
const result = {
  repeatedHelp: "passed",
  movementFacing: "passed",
  automaticTargeting: "passed",
  portraitTouchTargets: sizes,
  landscapeTouchTargets: landscapeSizes,
  touchMovement: moved.player,
  automaticLaunches: launched.launched,
  headlessRafFps: Math.round(fps),
  errors,
};
console.log(JSON.stringify(result, null, 2));
await fs.writeFile(
  ".impeccable/review/regressions.json",
  JSON.stringify(result, null, 2),
);
await browser.close();
