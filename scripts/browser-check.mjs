import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5184/play/");
await page.waitForFunction(() => window.__JUNK_MAGNET__, { timeout: 20000 });
await page.screenshot({ path: ".impeccable/review/desktop-ready.png" });
await page.locator("#start").click();
await page.waitForTimeout(1000);
await page.screenshot({ path: ".impeccable/review/desktop.png" });
console.log(
  "STATE",
  await page.evaluate(() => window.__JUNK_MAGNET__.snapshot()),
);
await page.keyboard.down("KeyD");
await page.waitForTimeout(700);
await page.keyboard.up("KeyD");
console.log(
  "MOVED",
  await page.evaluate(() => window.__JUNK_MAGNET__.snapshot()),
);
await page.waitForFunction(
  () => window.__JUNK_MAGNET__.snapshot().launched > 0,
);
console.log(
  "AUTO ATTACK",
  await page.evaluate(() => window.__JUNK_MAGNET__.snapshot()),
);
await page.getByRole("button", { name: "Pause game", exact: true }).click();
const paused = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
await page.waitForTimeout(350);
const still = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
if (paused.time !== still.time) errors.push("Pause did not freeze time");
await page.getByRole("button", { name: "BACK TO THE YARD" }).click();
await page.getByRole("button", { name: "Pause game", exact: true }).click();
await page.getByRole("button", { name: "How to play" }).click();
await page.getByRole("button", { name: "Start a fresh shift" }).click();
console.log(
  "RESET",
  await page.evaluate(() => window.__JUNK_MAGNET__.snapshot()),
);
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
mobile.on("pageerror", (e) => errors.push(String(e)));
await mobile.goto("http://127.0.0.1:5184/play/");
await mobile.waitForFunction(() => window.__JUNK_MAGNET__);
await mobile.locator("#start").click();
await mobile.waitForTimeout(350);
await mobile.screenshot({ path: ".impeccable/review/mobile.png" });
console.log(
  "MOBILE",
  await mobile.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    state: window.__JUNK_MAGNET__.snapshot(),
  })),
);
await mobile.setViewportSize({ width: 844, height: 390 });
await mobile.waitForTimeout(300);
await mobile.waitForTimeout(350);
await mobile.screenshot({ path: ".impeccable/review/mobile-landscape.png" });
console.log("ERRORS", errors);
await fs.writeFile(
  ".impeccable/review/browser-check.json",
  JSON.stringify({ errors, paused, still }, null, 2),
);
await browser.close();
if (errors.length) process.exitCode = 1;
