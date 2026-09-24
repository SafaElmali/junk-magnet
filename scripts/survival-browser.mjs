import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const baseURL = process.env.GAME_URL ?? 'http://127.0.0.1:5185/play/';
const out = '.impeccable/review';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile, hasTouch: mobile,
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    await page.goto(baseURL);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    await page.locator('#start').click();
    // Reach a real level through ordinary attacks and pickups, with no state injection.
    await page.waitForFunction(() => ['upgrade', 'lost'].includes(window.__JUNK_MAGNET__.snapshot().phase), null, { timeout: 60000 });
    const pending = await state();
    assert.equal(pending.phase, 'upgrade', 'Opening combat should reach a level-up');
    assert.equal(await page.locator('#upgrade-choices button').count(), 3);
    assert.equal(new Set(pending.choices).size, 3);
    await page.waitForTimeout(200);
    assert.equal((await state()).time, pending.time, 'Upgrade pauses time');
    await page.keyboard.press('Escape');
    assert.equal((await state()).phase, 'upgrade', 'Escape cannot skip the upgrade');
    assert.equal(await page.locator('#upgrade').isVisible(), true);
    const capture = mobile ? 'survival-upgrade-mobile.png' : 'survival-upgrade-desktop.png';
    await page.screenshot({ path: `${out}/${capture}` });
    if (mobile) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.screenshot({ path: `${out}/survival-upgrade-landscape.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#upgrade-choices button').first().tap();
    } else {
      await page.keyboard.press('Digit1');
    }
    const selected = await state();
    assert.equal(selected.upgrades[pending.choices[0]], pending.upgrades[pending.choices[0]] + 1);
    assert.ok(['playing', 'upgrade'].includes(selected.phase));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    // Traverse beyond the old arena while checking that camera and world follow.
    const start = selected.player;
    let maxTravel = 0;
    let previous = start;
    let direction = 0;
    const directions = ['KeyD', 'KeyW', 'KeyA', 'KeyS'];
    for (let step = 0; step < 45 && maxTravel < 38; step++) {
      const current = await state();
      if (current.phase === 'upgrade') {
        await page.locator('#upgrade-choices button').first().click();
      } else if (current.phase === 'lost') {
        throw new Error('Traversal unexpectedly ended in death');
      }
      const key = directions[direction];
      await page.keyboard.down(key);
      await page.waitForTimeout(250);
      await page.keyboard.up(key);
      const next = await state();
      maxTravel = Math.max(maxTravel, Math.hypot(next.player.x - start.x, next.player.z - start.z));
      if (Math.hypot(next.player.x - previous.x, next.player.z - previous.z) < 0.2) direction = (direction + 1) % directions.length;
      previous = next.player;
    }
    const walked = await state();
    assert.ok(maxTravel > 25, `Endless traversal exceeded former bounds: ${maxTravel}`);
    assert.ok(walked.world.chunks > 0 && walked.world.chunks <= 49, 'Visible chunks stay bounded');
    assert.ok(Math.abs(walked.world.camera.x - walked.player.x) < 2, 'Camera tracks player');
    await page.screenshot({ path: `${out}/survival-${mobile ? 'mobile' : 'desktop'}.png` });
    assert.deepEqual(errors, []);
    evidence.push({ mobile, levelUpTime: pending.time, choices: pending.choices, selected: pending.choices[0], maxTravel, final: walked, errors });
    console.log(JSON.stringify({ mobile, levelUpTime: pending.time, maxTravel, world: walked.world, errors }));
    await page.close();
  }
  await fs.writeFile(`${out}/survival-browser.json`, JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
