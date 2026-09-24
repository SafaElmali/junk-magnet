import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

// Run against Vite with VITE_ANALYTICS_DEV=true and a dummy VITE_POSTHOG_KEY.
// Intercept all PostHog traffic: this test never ingests fake player activity.
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
  const events = [];
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/https:\/\/[^/]*posthog\.com\//, async (route) => {
    const request = route.request();
    requests.push(request.url());
    if (request.url().includes("/e/")) {
      let body = request.postDataBuffer();
      if (body?.[0] === 0x1f && body?.[1] === 0x8b) body = gunzipSync(body);
      if (body) {
        const payload = JSON.parse(body.toString());
        events.push(
          ...(Array.isArray(payload) ? payload : (payload.batch ?? [payload])),
        );
      }
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.addInitScript(() => {
    // Exercise the capture path as a real player; the SDK ignores automation bots.
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    localStorage.setItem(
      "junk-magnet-workshop-v1",
      JSON.stringify({
        version: 1,
        parts: 600,
        selectedRobot: "scrap",
        unlockedRobots: ["scrap"],
        upgrades: { hull: 0, magnet: 0 },
        bestTime: 0,
        bestKills: 0,
        completedRuns: 0,
        recentRunIds: [],
      }),
    );
  });
  await page.goto(process.env.ANALYTICS_TEST_URL || "http://127.0.0.1:5196/play/");
  await page.waitForFunction(() => window.__JUNK_MAGNET__, { timeout: 30000 });
  await page.locator("#menu-workshop").click();
  await page.locator('[data-robot-step="1"]').click();
  await page.locator('[data-robot-action="unlock"]').click();
  await page.locator('[data-robot-action="select"]').click();
  await page.locator('[data-workshop-tab="upgrades"]').click();
  await page.locator('[data-permanent-upgrade="hull"]').click();
  await page.locator("#menu-back").click();
  await page.locator("#start").click();
  await page.waitForFunction(
    () => window.__JUNK_MAGNET__.snapshot().time > 0.2,
  );
  await page.locator("#pause").click();
  await page.locator("#pause-menu").click();
  await page.locator("#start").click();
  await page.locator("#pause").click();
  await page.locator("#restart").click();
  await page.waitForTimeout(4000); // SDK batches captures every few seconds.
  assert.deepEqual(errors, []);
  const ofType = (name) => events.filter((e) => e.event === name);
  assert.equal(ofType("game_loaded").length, 1, JSON.stringify(requests));
  assert.equal(
    ofType("run_started").length,
    2,
    "resume must not start another run",
  );
  assert.equal(ofType("run_abandoned").length, 1);
  assert.equal(ofType("robot_unlocked").length, 1);
  assert.equal(ofType("robot_selected").length, 1);
  assert.equal(ofType("workshop_upgrade_purchased").length, 1);
  assert.equal(ofType("run_started")[0].properties.robot_id, "scout");
  assert.ok(events.every((e) => e.properties.environment === "development"));
  assert.ok(
    events.every((e) => !e.event.startsWith("$")),
    "no automatic click/page capture",
  );
  console.log(
    JSON.stringify({
      passed: true,
      events: events.map((e) => e.event),
      errors,
    }),
  );
} finally {
  await browser.close();
}
