import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:5184/play/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const read = page => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
const errors = [];

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#start').tap();
    const drone = page.locator('.drone-control');
    await drone.waitFor({ state: 'visible' });
    const stickBox = await page.locator('#touch-stick').boundingBox();
    const droneBox = await drone.boundingBox();
    const movement = { x: stickBox.x + stickBox.width / 2, y: stickBox.y + stickBox.height / 2, id: 1 };
    const switchTouch = { x: droneBox.x + droneBox.width / 2, y: droneBox.y + droneBox.height / 2, id: 2 };
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

    await touch('touchStart', [movement]);
    movement.x += 35;
    await touch('touchMove', [movement]);
    await page.waitForTimeout(150);
    assert.equal((await read(page)).drone.mode, 'collector');

    for (const mode of ['repair', 'guard', 'collector']) {
      await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().drone.modeCooldown === 0 && !document.querySelector('.drone-control').disabled);
      const before = await read(page);
      await touch('touchStart', [movement, switchTouch]);
      // Keep both fingers moving: browsers may suppress compatibility clicks.
      movement.x += 1;
      await touch('touchMove', [movement, switchTouch]);
      await page.waitForTimeout(450);
      await touch('touchEnd', [switchTouch]);
      await page.waitForTimeout(50);
      const after = await read(page);
      assert.equal(after.drone.mode, mode, 'Second finger changes the drone exactly once, even after a long press');
      assert.ok(after.player.x > before.player.x, 'Movement continues while switching the drone');
      assert.ok(await page.locator('#touch-stick').evaluate(el => el.classList.contains('is-dragging')));
    }

    await touch('touchEnd', []);
    await page.waitForTimeout(100);
    const stopped = await read(page);
    await page.waitForTimeout(100);
    assert.deepEqual((await read(page)).player, stopped.player, 'Releasing the joystick stops movement');
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().drone.modeCooldown === 0 && !document.querySelector('.drone-control').disabled);
    await drone.tap();
    assert.equal((await read(page)).drone.mode, 'repair', 'Single-finger tap still works');
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().drone.modeCooldown === 0 && !document.querySelector('.drone-control').disabled);
    await drone.focus();
    await page.keyboard.press('Enter');
    assert.equal((await read(page)).drone.mode, 'guard', 'Keyboard button activation still works');
    console.log(`Drone touch controls passed at ${viewport.width}×${viewport.height}`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
