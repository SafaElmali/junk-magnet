// Real gameplay input: approach enemies, observe a contact hit, then pause/resume.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator("#start").click();
  const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  let hit;
  for (let i = 0; i < 220; i++) {
    const state = await read();
    if (state.hp < 100 && state.world.robotHurt.strength > 0) {
      hit = state;
      break;
    }
    if (state.phase === "upgrade") {
      await page.locator(".upgrade-choice").first().click();
      continue;
    }
    if (state.phase === "lost") break;
    const enemy = state.enemies
      .filter((e) => e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - state.player.x, a.z - state.player.z) -
          Math.hypot(b.x - state.player.x, b.z - state.player.z),
      )[0];
    if (enemy) {
      const dx = enemy.x - state.player.x,
        dz = enemy.z - state.player.z;
      const keys = [
        ...(Math.abs(dx) > 0.2 ? [dx > 0 ? "KeyD" : "KeyA"] : []),
        ...(Math.abs(dz) > 0.2 ? [dz > 0 ? "KeyS" : "KeyW"] : []),
      ];
      for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(70);
      for (const key of keys) await page.keyboard.up(key);
    } else await page.waitForTimeout(70);
  }
  assert.ok(hit, "actual contact damage produced visible robot response");
  await page.locator("#pause").click();
  const paused = await read();
  await page.waitForTimeout(300);
  const after = await read();
  assert.equal(after.time, paused.time);
  assert.deepEqual(after.world.robotHurt, paused.world.robotHurt);
  await page.screenshot({
    path: ".impeccable/review/features-gameplay-hit.png",
  });
  await page.locator("#restart").click();
  const reset = await read();
  assert.equal(reset.hp, 100);
  assert.equal(reset.world.robotHurt.strength, 0);
  assert.deepEqual(errors, []);
  const report = {
    hpOnHit: hit.hp,
    timeOnHit: hit.time,
    hurt: hit.world.robotHurt,
    paused: paused.world.robotHurt,
    resetHp: reset.hp,
    errors,
  };
  await fs.writeFile(
    ".impeccable/review/features-gameplay-damage.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
