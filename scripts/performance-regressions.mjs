import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Build with VITE_COOP_ENABLED=true to exercise the opt-in co-op flow locally.
const url = process.env.GAME_URL ?? 'http://127.0.0.1:5279/play/';
const output = process.env.PERF_OUTPUT ?? '.impeccable/review/performance-after';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
const read = page => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
async function idle(page, label) {
  await page.waitForTimeout(300);
  const before = await read(page);
  await page.waitForTimeout(600);
  const after = await read(page);
  assert.equal(after.world.frames, before.world.frames, `${label}: no redundant renders`);
  assert.equal(after.time, before.time, `${label}: simulation stays frozen`);
  return after;
}
async function loaded(options = {}) {
  const page = await browser.newPage(options);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  return page;
}
try {
  for (const mobile of [false, true]) {
    const page = await loaded({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 2,
    });
    const initial = await idle(page, 'menu');
    assert.equal(initial.world.graphics.quality, 'balanced');
    assert.equal(initial.world.graphics.pixelRatio, 1.5);
    if (!mobile) {
      await page.locator('#menu-settings').click();
      await page.locator('#menu-quality').click();
      const cycles = [];
      for (let i = 0; i < 3; i++) {
        const pair = {};
        for (const quality of ['high', 'performance']) {
          await page.locator(`[data-quality="${quality}"]`).click();
          await page.waitForFunction(q => window.__JUNK_MAGNET__.snapshot().world.graphics.quality === q, quality);
          const state = await idle(page, `quality ${quality}`);
          pair[quality] = state.world.textures;
        }
        assert.ok(pair.performance < pair.high, 'Downgrading releases GPU textures');
        cycles.push(pair);
      }
      assert.equal(cycles[2].performance, cycles[0].performance, 'Repeated quality changes do not accumulate textures');
      await page.locator('[data-quality="high"]').click();
      await page.reload();
      await page.waitForFunction(() => window.__JUNK_MAGNET__);
      assert.equal((await read(page)).world.graphics.quality, 'high', 'Saved quality is respected');
      results.push({ qualityCycles: cycles, savedQuality: true });
    }
    await page.locator('#start').click();
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(650);
    await page.keyboard.up('KeyD');
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === 'upgrade', null, { timeout: 15000 });
    const upgrade = await idle(page, 'upgrade choice');
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(200);
    assert.ok((await read(page)).time > upgrade.time, 'Upgrade selection wakes the loop');
    await page.locator('#pause').click();
    const paused = await idle(page, 'pause');
    await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1200, height: 800 });
    const resized = await idle(page, 'resized pause');
    assert.ok(resized.world.frames > paused.world.frames, 'Resize redraws the frozen scene');
    assert.notEqual(resized.world.graphics.width, paused.world.graphics.width);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await idle(page, 'reduced motion');
    assert.ok(reduced.world.frames > resized.world.frames, 'Reduced-motion changes redraw the frozen scene');
    await page.locator('#language').click();
    await idle(page, 'translated pause');
    await page.locator('#resume').click();
    await page.waitForTimeout(200);
    const resumed = await read(page);
    assert.ok(resumed.time > paused.time && resumed.time < paused.time + 0.5, 'Resume advances without catching up idle time');
    await page.locator('[data-owned-ability]').first().click();
    const inspected = await idle(page, 'owned ability details');
    await page.locator('#build-inspector footer button').click();
    await page.waitForTimeout(200);
    assert.ok((await read(page)).time > inspected.time, 'Closing ability details wakes the loop');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await idle(page, 'simulated hidden tab');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await idle(page, 'returned tab stays paused');
    await page.locator('#pause-menu').click();
    await idle(page, 'return to menu');
    await page.locator('#start').click();
    await page.waitForTimeout(200);
    assert.equal((await read(page)).phase, 'playing');
    await page.locator('#pause').click();
    await page.locator('#restart').click();
    await page.waitForTimeout(100);
    const restarted = await read(page);
    assert.equal(restarted.phase, 'playing');
    assert.equal(restarted.level, 1);
    assert.ok(restarted.time < 0.5);
    await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'desktop'}-regression.png` });
    results.push({ mobile, idle: true, upgradeResume: true, inspectorResume: true, resize: true, reducedMotion: true, language: true, visibility: true, menuResume: true, restart: true });
    await page.close();
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'} idle/resume/resize/quality`);
  }
  const a = await loaded(), b = await loaded();
  await a.locator('#menu-coop').click();
  await a.locator('[data-coop=create]').click();
  const code = await a.locator('.coop-room-code strong').innerText();
  await b.locator('#menu-coop').click();
  await b.locator('#coop-code').fill(code);
  await b.locator('[data-coop=join]').click();
  await a.locator('[data-coop=start]').click();
  await a.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().coop.active);
  await b.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().coop.active);
  await a.locator('#pause').click();
  const before = await read(a);
  await a.waitForTimeout(650);
  const after = await read(a);
  assert.ok(after.time > before.time + 0.3 && after.world.frames > before.world.frames, 'Co-op keeps simulating and rendering in its menu');
  const partner = await read(b);
  assert.ok(partner.time > before.time + 0.3);
  await a.locator('[data-coop=leave]').click();
  await b.waitForFunction(() => !window.__JUNK_MAGNET__.snapshot().coop.active);
  await idle(a, 'left co-op');
  await idle(b, 'partner disconnected');
  results.push({ coopMenuLive: true, disconnectIdles: true });
  assert.deepEqual(errors, []);
  await writeFile(`${output}/regressions.json`, JSON.stringify({ results, errors }, null, 2) + '\n');
  console.log('PASS co-op stays live; disconnect returns to idle');
} finally { await browser.close(); }
