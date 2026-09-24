import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "tr-TR",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5185/play/");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator("#start").click();
  const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  // Real unattended play allows the horde to cause a natural defeat; no state edits.
  for (let i = 0; i < 500; i++) {
    const state = await read();
    if (state.phase === "lost") break;
    if (state.phase === "upgrade") {
      const order = [
        "boots",
        "magnet",
        "refill",
        "saw",
        "overclock",
        "turret",
        "burst",
        "lightning",
        "armor",
        "repair",
      ];
      const id = order.find((id) => state.choices.includes(id));
      await page.locator(`[data-upgrade="${id}"]`).click();
    }
    if (i % 40 === 0)
      console.log(`real play ${Math.floor(state.time)}s, hp ${state.hp}`);
    await page.waitForTimeout(400);
  }
  const lost = await read();
  assert.equal(lost.phase, "lost");
  await page.locator("#result").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#result-kills").innerText(),
    String(lost.kills),
  );
  const owned = Object.values(lost.upgrades).filter(
    (rank, i) => i < 7 && rank > 0,
  ).length;
  assert.equal(await page.locator(".result-module").count(), owned);
  await page.screenshot({
    path: ".impeccable/review/expansion-result-live.png",
  });
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("junk-magnet-workshop-v1")),
  );
  assert.equal(stored.completedRuns, 1);
  assert.equal(
    stored.parts,
    lost.earnedParts + Math.floor(lost.kills / 10) + Math.floor(lost.time / 30),
  );
  assert.equal(lost.receipt.earned, stored.parts);
  assert.ok(
    (await page.locator("#result-reward").innerText()).includes(
      String(stored.parts),
    ),
  );
  await page.locator("#language").click();
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("junk-magnet-workshop-v1")),
    ),
    stored,
    "language changes cannot award the same run twice",
  );
  assert.equal((await read()).time, lost.time);
  assert.equal(
    await page.locator("#result-title").innerText(),
    "SCHICHT BEENDET",
  );
  await page.locator("#result-menu").click();
  assert.ok(await page.locator("#start").isVisible());
  await page.locator("#start").click();
  assert.equal((await read()).phase, "playing");
  assert.equal((await read()).hp, 100);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    ".impeccable/review/expansion-result-live.json",
    JSON.stringify(
      {
        fixture: false,
        hp: lost.hp,
        time: lost.time,
        kills: lost.kills,
        owned,
        languageSwitchPreserves: true,
        mainMenuFreshStart: true,
        progress: stored,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS real contact loss, persisted rewards once, result stats, language change and fresh start",
  );
} finally {
  await browser.close();
}
