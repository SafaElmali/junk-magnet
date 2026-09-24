import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const url = process.env.GAME_URL ?? "http://127.0.0.1:5185/play/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  reports = [];
await fs.mkdir(".impeccable/review/coop", { recursive: true });
try {
  const a = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "tr-TR",
  });
  const b = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "tr-TR",
    hasTouch: true,
    isMobile: true,
  });
  for (const p of [a, b]) {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
  }
  await Promise.all([a.goto(url), b.goto(url)]);
  await Promise.all([
    a.locator("#menu-coop").waitFor({ state: "visible" }),
    b.locator("#menu-coop").waitFor({ state: "visible" }),
  ]);
  await a.locator("#menu-coop").click();
  await a.locator("[data-coop=create]").click();
  await a.locator(".coop-room-code strong").waitFor();
  const code = await a.locator(".coop-room-code strong").innerText();
  await a.screenshot({ path: ".impeccable/review/coop/desktop-lobby.png" });
  await b.locator("#menu-coop").click();
  await b.locator("#coop-code").fill(code);
  await b.locator("[data-coop=join]").click();
  await b.locator(".coop-room-code strong").waitFor();
  await b.screenshot({ path: ".impeccable/review/coop/mobile-lobby.png" });
  const layout = await b
    .locator(".coop-sheet")
    .evaluate((el) => ({
      scroll: el.scrollHeight > el.clientHeight + 1,
      bottom: el.getBoundingClientRect().bottom,
      h: innerHeight,
    }));
  assert.equal(layout.scroll, false);
  assert.ok(layout.bottom <= layout.h);
  await a.locator("[data-coop=start]").click();
  const read = (p) => p.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  await Promise.all([
    a.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().coop.active),
    b.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().coop.active),
  ]);
  await a.keyboard.down("KeyD");
  await a.waitForTimeout(350);
  await a.keyboard.up("KeyD");
  const after = await read(a);
  assert.ok(after.player.x > -0.2);
  assert.ok(after.coop.partner);
  assert.equal((await read(b)).coop.code, code);
  // Move to the real opening chest; do not inject game state.
  for (let i = 0; i < 65; i++) {
    const s = await read(a);
    const dx = 4 - s.player.x,
      dz = -s.player.z;
    if (Math.hypot(dx, dz) < 0.45) break;
    const key =
      Math.abs(dx) > Math.abs(dz)
        ? dx > 0
          ? "KeyD"
          : "KeyA"
        : dz > 0
          ? "KeyS"
          : "KeyW";
    await a.keyboard.down(key);
    await a.waitForTimeout(45);
    await a.keyboard.up(key);
    await a.waitForTimeout(80);
  }
  await a.waitForFunction(
    () => window.__JUNK_MAGNET__.snapshot().choices.length > 0,
    { timeout: 10000 },
  );
  const before = await read(a);
  const enemyBefore = before.enemies[0];
  await a.locator(".coop-upgrade-toggle").click();
  assert.equal(await a.locator("#upgrade").isVisible(), false);
  await a.keyboard.down("KeyW");
  await a.waitForTimeout(450);
  await a.keyboard.up("KeyW");
  const during = await read(a);
  assert.ok(during.time > before.time + 0.3);
  assert.ok(during.player.z < before.player.z - 0.8);
  assert.notDeepEqual(during.enemies[0], enemyBefore);
  assert.equal(during.phase, "playing");
  assert.ok(during.choices.length > 0);
  await a.screenshot({ path: ".impeccable/review/coop/desktop-upgrades.png" });
  await b.locator(".coop-upgrade-toggle").click();
  await b.screenshot({ path: ".impeccable/review/coop/mobile-upgrades.png" });
  await a.keyboard.press("Digit1");
  await a.waitForTimeout(150);
  assert.equal((await read(a)).choices.length, 0);
  assert.equal((await read(b)).choices.length, 3);
  // A local menu and background/blur never pause the other player's world.
  const t = (await read(a)).time;
  await a.locator("#pause").click();
  await a.waitForTimeout(700);
  assert.ok((await read(a)).time > t + 0.4);
  assert.ok((await read(b)).time > t + 0.4);
  await a.locator("[data-coop=resume]").first().click();
  await a.evaluate(() => window.dispatchEvent(new Event("blur")));
  await a.waitForTimeout(200);
  assert.equal(await a.locator("#coop-lobby").isVisible(), false);
  assert.equal((await read(a)).phase, "playing");
  // Actual touch drag while the mobile upgrade list stays open.
  const mb = await read(b),
    cdp = await b.context().newCDPSession(b);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 75, y: 720 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 120, y: 720 }],
  });
  await b.waitForTimeout(400);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok((await read(b)).player.x > mb.player.x + 0.4);
  await b.locator("#coop-upgrades [data-upgrade]").first().click();
  await a.locator("#pause").click();
  await a.locator("[data-coop=leave]").click();
  await b.locator("#coop-lobby [role=alert]").waitFor();
  assert.equal((await read(b)).coop.active, false);
  reports.push({
    code,
    sharedXP: true,
    movementDuringUpgrade: true,
    enemiesContinue: true,
    menuDoesNotPause: true,
    touchDuringUpgrade: true,
    disconnect: true,
    errors,
  });
  assert.deepEqual(errors, []);
  // Solo pause behavior remains unchanged after exiting co-op.
  await a.locator("#start").click();
  await a.waitForTimeout(200);
  await a.locator("#pause").click();
  const solo = (await read(a)).time;
  await a.waitForTimeout(300);
  assert.equal((await read(a)).time, solo);
  reports[0].soloPausePreserved = true;
  await fs.writeFile(
    ".impeccable/review/coop/report.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
