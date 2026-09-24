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
  await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185/play/");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator("#start").click();
  const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  for (let i = 0; i < 700; i++) {
    const s = await read();
    if (s.phase === "lost") break;
    if (s.phase === "upgrade") {
      await page
        .locator('.upgrade-choice:not([data-upgrade="repair"])')
        .first()
        .click();
      continue;
    }
    const e = s.enemies
      .filter((e) => e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - s.player.x, a.z - s.player.z) -
          Math.hypot(b.x - s.player.x, b.z - s.player.z),
      )[0];
    const keys = e
      ? [
          ...(Math.abs(e.x - s.player.x) > 0.12
            ? [e.x > s.player.x ? "KeyD" : "KeyA"]
            : []),
          ...(Math.abs(e.z - s.player.z) > 0.12
            ? [e.z > s.player.z ? "KeyS" : "KeyW"]
            : []),
        ]
      : [];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(65);
    for (const k of keys) await page.keyboard.up(k);
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
    path: ".impeccable/review/result-redesign-live.png",
  });
  await page.locator("#language").click();
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
    ".impeccable/review/result-redesign-live.json",
    JSON.stringify(
      {
        fixture: false,
        hp: lost.hp,
        time: lost.time,
        kills: lost.kills,
        owned,
        languageSwitchPreserves: true,
        mainMenuFreshStart: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS natural contact loss, live result stats/build, language switch, main menu and fresh start",
  );
} finally {
  await browser.close();
}
