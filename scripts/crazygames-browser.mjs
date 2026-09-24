// Checks the CrazyGames build against the real SDK in its localhost ("local") mode:
// npm run build:crazygames && npx vite preview --outDir dist-crazygames --port 5187
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5187";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  const failed = [];
  const hosts = new Set();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on(
    "response",
    (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`),
  );
  page.on("request", (r) => hosts.add(new URL(r.url()).hostname));
  // The SDK logs each request in local mode ("Requesting gameplay start (local)").
  const sdkCalls = [];
  page.on("console", (message) => {
    const call = message
      .text()
      .match(/Requesting (game loading|gameplay) (start|stop)/);
    if (call)
      sdkCalls.push(
        `${call[1] === "gameplay" ? "gameplay" : "loading"} ${call[2]}`,
      );
  });
  // A returning browser player: earlier progress lives in plain localStorage.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem(
      "junk-magnet-workshop-v1",
      JSON.stringify({ version: 1, parts: 77 }),
    );
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__JUNK_MAGNET__, null, {
    timeout: 60_000,
  });
  assert.equal(
    await page.evaluate(() => window.CrazyGames.SDK.environment),
    "local",
  );
  assert.deepEqual(sdkCalls, ["loading start", "loading stop"]);

  // Draco models decoded: the robot and batched enemies render.
  const world = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  assert.ok(world.triangles > 1000, `rendered ${world.triangles} triangles`);
  const saved = await page.evaluate(() =>
    JSON.parse(window.CrazyGames.SDK.data.getItem("junk-magnet-workshop-v1")),
  );
  assert.equal(
    saved.parts,
    77,
    "browser progress migrated into the data module",
  );
  await page.screenshot({ path: ".impeccable/review/crazygames-menu.png" });

  await page.locator("#start").click();
  await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().time > 2);
  await page.screenshot({ path: ".impeccable/review/crazygames-play.png" });
  await page.locator("#pause").click();
  await page.locator("#resume").click();
  await page.waitForFunction(
    () => window.__JUNK_MAGNET__.snapshot().phase === "playing",
  );
  // The SDK throttles gameplay calls closer than ~1 s apart and applies them late.
  await page.waitForTimeout(1200);
  assert.deepEqual(sdkCalls.slice(2), [
    "gameplay start",
    "gameplay stop",
    "gameplay start",
  ]);

  // Settings now write to the data module, not plain localStorage.
  await page.locator("#pause").click();
  await page.locator("#pause-menu").click();
  await page.locator("#menu-settings").click();
  await page.locator("#menu-sound").click();
  await page.waitForTimeout(1200);
  assert.equal(sdkCalls.at(-1), "gameplay stop", "menus stop gameplay");
  assert.ok(
    await page.evaluate(() =>
      window.CrazyGames.SDK.data.getItem("junk-magnet-audio-v2"),
    ),
  );

  assert.ok(![...hosts].some((h) => h.includes("posthog")), [...hosts].join());
  assert.deepEqual(failed, []);
  assert.deepEqual(errors, []);
  console.log("CrazyGames build passed:", sdkCalls.join(" → "));
} finally {
  await browser.close();
}
