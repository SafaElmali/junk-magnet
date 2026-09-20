import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const baseURL = process.env.GAME_URL ?? 'http://127.0.0.1:5185';
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    const state = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    await page.locator('#start').tap();
    const cdp = await page.context().newCDPSession(page);
    const rect = await page.locator('#yard').boundingBox();
    const x = Math.round(rect.x + rect.width * 0.45);
    const y = Math.round(rect.y + rect.height * 0.6);
    const finger = { x: x + 40, y: y - 20, id: 1 };
    const before = await state();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 5; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + step * 8, y: y - step * 4, id: 1 }] });
    }
    await page.waitForTimeout(350);
    const moving = await state();
    assert.equal(moving.phase, 'playing', 'Arena swipe must not pause');
    assert.ok(moving.player.x > before.player.x + 0.3, 'Arena swipe moves robot');
    assert.ok(moving.player.z < before.player.z, 'Swipe direction controls movement');
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'Game must not scroll');

    const launch = await page.locator('#launch').boundingBox();
    const secondFinger = { x: launch.x + launch.width / 2, y: launch.y + launch.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger, secondFinger] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [finger] });
    await page.waitForTimeout(150);
    const firing = await state();
    assert.equal(firing.launched, 1, 'Second finger can launch while moving');
    assert.ok(firing.player.x > moving.player.x, 'Releasing launch finger must not stop movement');

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const cancelled = await state();
    await page.waitForTimeout(150);
    assert.deepEqual((await state()).player, cancelled.player, 'Cancelled gesture must stop movement');
    assert.equal(await page.locator('#touch-stick').evaluate(el => el.style.top), '', 'Joystick returns home');

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal((await state()).phase, 'playing', 'Visible mobile focus change must not pause');
    await page.locator('#pause').tap();
    const paused = await state();
    await page.waitForTimeout(100);
    assert.equal((await state()).time, paused.time, 'Explicit pause still freezes gameplay');
    await page.locator('#resume').tap();
    assert.equal((await state()).phase, 'playing');
    // Model the browser visibility notification without changing simulation state.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    assert.equal((await state()).phase, 'paused', 'Leaving the tab must still pause');
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}x${viewport.height}: swipe, no scrolling, multitouch launch, cancellation, focus and pause passed`);
    await page.close();
  }
} finally {
  await browser.close();
}
