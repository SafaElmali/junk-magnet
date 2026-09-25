import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], levels = [];
page.on('pageerror', e => errors.push(e.message));
const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
const priority = ['turret', 'lightning', 'burst', 'saw', 'armor', 'magnet', 'boots', 'repair'];
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5185/play/');
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator('#start').click();
  let previous = { x: 0, z: 0 }, peakEnemies = 0;
  for (let i = 0; i < 480; i++) {
    const s = await read();
    peakEnemies = Math.max(peakEnemies, s.enemyCount);
    if (s.phase === 'lost') break;
    if (s.phase === 'upgrade') {
      await page.waitForTimeout(300);
      const choice = priority.find(id => s.choices.includes(id)) ?? s.choices[0];
      levels.push({ time: s.time, level: s.level, choice });
      // A rank-3 weapon offers its branches instead of upgrades; take the first.
      await page.locator(choice ? `[data-upgrade="${choice}"]` : '[data-specialization]').first().click();
      continue;
    }
    const byDistance = (a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z);
    const target = [...s.xpDrops].sort(byDistance)[0] ?? [...s.enemies].sort(byDistance)[0];
    let dx = target ? target.x - s.player.x : Math.cos(i / 20);
    let dz = target ? target.z - s.player.z : Math.sin(i / 20);
    // Stop at orbit range when harvesting an enemy; this is a simple QA bot, not Jev.
    const length = Math.hypot(dx, dz);
    if (!s.xpDrops.length && length < 2.5) dx = dz = 0;
    if (i > 0 && length > 3 && Math.hypot(s.player.x - previous.x, s.player.z - previous.z) < 0.03) [dx, dz] = [-dz, dx];
    previous = s.player;
    const held = [];
    if (Math.abs(dx) > 0.2) held.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dz) > 0.2) held.push(dz > 0 ? 'KeyS' : 'KeyW');
    for (const key of held) await page.keyboard.down(key);
    await page.waitForTimeout(250);
    for (const key of held) await page.keyboard.up(key);
  }
  const final = await read();
  await page.screenshot({ path: '.impeccable/review/survival-playthrough.png' });
  assert.ok(final.level >= 3, 'Real play reaches repeated level choices');
  assert.ok(final.kills > 36, 'Real play continues beyond old kill limit');
  let restart = 'not reached';
  if (final.phase === 'lost') {
    await page.locator('#again').click();
    const fresh = await read();
    assert.equal(fresh.level, 1);
    assert.equal(fresh.kills, 0);
    assert.equal(fresh.upgrades.turret, 0);
    restart = 'passed';
  }
  assert.deepEqual(errors, []);
  const report = { final, levels, peakEnemies, restart, errors, method: 'Real frame timing, read-only snapshots and keyboard input. Simple deterministic QA bot, not Jev.' };
  await fs.writeFile('.impeccable/review/survival-playthrough.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ time: final.time, level: final.level, kills: final.kills, phase: final.phase, levels, peakEnemies, restart, errors }));
} finally { await browser.close(); }
