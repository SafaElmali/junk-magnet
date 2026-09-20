import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// Production QA driven exclusively by keyboard/UI. Snapshots are read-only;
// no position, enemy, reward, health or clock fixtures are injected.
const url = process.env.GAME_URL ?? "http://127.0.0.1:5185";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      locale: "tr-TR",
      hasTouch: width < 900,
      isMobile: width < 900,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    const choose = async () => {
      let snap = await read();
      for (let n = 0; snap.phase === "upgrade" && n < 8; n++) {
        const preferred = [
          "lightning",
          "burst",
          "armor",
          "turret",
          "saw",
          "repair",
        ].find((id) => snap.choices.includes(id));
        const index = Math.max(0, snap.choices.indexOf(preferred));
        await page.locator(".upgrade-choice").nth(index).click();
        snap = await read();
      }
      assert.notEqual(
        snap.phase,
        "lost",
        "Player survived the real discovery route",
      );
      return snap;
    };
    const waitPlayingTime = async (seconds) => {
      const target = (await read()).time + seconds;
      for (let n = 0; n < 400; n++) {
        const s = await choose();
        if (s.time >= target) return s;
        await page.waitForTimeout(60);
      }
      throw new Error("Simulation did not advance in time");
    };
    const drive = async (x, z) => {
      for (let n = 0; n < 200; n++) {
        const s = await choose();
        const dx = x - s.player.x,
          dz = z - s.player.z;
        if (Math.hypot(dx, dz) < 0.38) return;
        const wanted = new Set();
        if (Math.abs(dx) > 0.2) wanted.add(dx > 0 ? "d" : "a");
        if (Math.abs(dz) > 0.2) wanted.add(dz > 0 ? "s" : "w");
        for (const key of ["a", "d", "w", "s"]) {
          if (wanted.has(key)) await page.keyboard.down(key);
          else await page.keyboard.up(key);
        }
        await page.waitForTimeout(65);
        for (const key of wanted) await page.keyboard.up(key);
      }
      throw new Error(`Could not reach ${x},${z}`);
    };
    const hintLayout = () =>
      page.locator("#world-hint").evaluate((el) => {
        const r = el.getBoundingClientRect(),
          stick = document
            .querySelector("#touch-stick")
            .getBoundingClientRect();
        const visible = getComputedStyle(el).display !== "none";
        return {
          visible,
          text: el.textContent,
          fits:
            r.left >= 0 &&
            r.right <= innerWidth &&
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            el.scrollWidth <= el.clientWidth + 1,
          joystickOverlap:
            stick.width > 0 &&
            r.left < stick.right &&
            r.right > stick.left &&
            r.top < stick.bottom &&
            r.bottom > stick.top,
        };
      });
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    await page.locator("#start").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().phase === "playing",
    );
    await drive(4, 0);
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().chestsOpened === 1,
    );
    const chest = await read();
    assert.equal(chest.earnedParts, 3);
    assert.equal(
      chest.discoveries.find((p) => p.id === "0,0:chest").completed,
      true,
    );
    assert.equal(chest.phase, "upgrade");
    await choose();
    await page.locator("#world-hint").waitFor({ state: "visible" });
    const chestHint = await hintLayout();

    assert.ok(
      chestHint.visible && chestHint.fits && !chestHint.joystickOverlap,
    );
    assert.match(chestHint.text, /Alındı/);
    assert.match(chestHint.text, /Deneyim/);
    assert.match(chestHint.text, /Atölye parçası/);
    assert.match(chestHint.text, /tur sonunda/);
    assert.equal(chest.discoveryReward.xp, 5);
    assert.equal(chest.discoveryReward.parts, 3);
    await page.screenshot({
      path: `.impeccable/review/discovery-chest-live-${width}.png`,
    });
    await drive(0, -8);
    await waitPlayingTime(1.3);
    const before = await read();
    const progress = before.discoveries.find(
      (p) => p.id === "0,0:salvage",
    ).progress;
    assert.ok(progress > 0 && progress < 8);
    // Wait out the previous reward notice before measuring the quest hint.
    const receiptRemaining = Math.max(
      0,
      ((await read()).discoveryReward?.until ?? 0) - (await read()).time,
    );
    await waitPlayingTime(receiptRemaining + 0.15);
    const questHint = await hintLayout();
    assert.ok(
      questHint.visible && questHint.fits && !questHint.joystickOverlap,
    );
    assert.match(questHint.text, /Bölgede kal/);
    await page.screenshot({
      path: `.impeccable/review/discovery-quest-live-${width}.png`,
    });
    await page.locator("#pause").click();
    const paused = await read();
    assert.equal(paused.phase, "paused");
    await page.locator("#world-hint").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#world-hint").isVisible(), false);
    await page.waitForTimeout(300);
    assert.deepEqual((await read()).discoveries, paused.discoveries);
    assert.equal((await read()).time, paused.time);
    await page.locator("#resume").click();
    for (let n = 0; n < 350; n++) {
      const s = await choose();
      if (s.questsCompleted === 1) break;
      await page.waitForTimeout(60);
    }
    const completed = await read();
    assert.equal(completed.questsCompleted, 1);
    assert.equal(completed.earnedParts, 11);
    await choose();
    await page.screenshot({
      path: `.impeccable/review/discovery-claimed-live-${width}.png`,
    });
    assert.deepEqual(errors, []);
    reports.push({
      evidence: "actual UI + keyboard gameplay; no state injection",
      width,
      height,
      chest: {
        time: chest.time,
        earnedParts: chest.earnedParts,
        level: chest.level,
      },
      quest: {
        time: completed.time,
        earnedParts: completed.earnedParts,
        hp: completed.hp,
      },
      chestHint,
      questHint,
      pauseFrozen: true,
      errors,
    });
    await page.close();
  }
  await fs.writeFile(
    ".impeccable/review/discovery-browser.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
