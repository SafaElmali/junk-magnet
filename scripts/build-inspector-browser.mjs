import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ locale: "en-US" });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5186/play/');
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator('#start').click();
  const tile = page.locator('[data-owned-ability]').first();
  await tile.click();
  await page.waitForFunction(() => document.querySelector('#build-inspector').open);
  const paused = await page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
  assert.equal(paused.phase, 'paused');
  assert.equal(await page.locator('[data-inspect]').count(), Object.values(paused.upgrades).filter(rank => rank > 0).length);
  assert.equal(await page.locator('[data-inspect][aria-pressed="true"]').count(), 1);
  assert.ok((await page.locator('#build-inspector-detail p').innerText()).length > 30);
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().time), paused.time);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === 'playing');
  assert.equal(await tile.evaluate(el => document.activeElement === el), true);
  await tile.press('Enter');
  await page.waitForFunction(() => document.querySelector('#build-inspector').open);
  await page.locator('#build-inspector footer button').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.querySelector('#build-inspector').contains(document.activeElement)), true);
  await page.locator('#build-inspector footer button').click();
  await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === 'playing');
  assert.deepEqual(await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().upgrades), paused.upgrades);
  // Full-loadout layout fixture uses a separate state, never mutates the run.
  await page.locator('#pause').click();
  await page.evaluate(async () => {
    document.querySelector('#build-inspector').remove();
    const { setupBuildInspector } = await import('/src/build-inspector.ts');
    const { createState } = await import('/src/simulation.ts');
    const state = createState();
    Object.assign(state.upgrades, { saw: 5, lightning: 2, turret: 3, burst: 1, boots: 4, magnet: 2, armor: 1 });
    state.evolutions.vortex = true;
    state.phase = 'playing';
    const inspector = setupBuildInspector({ state: () => state, open: () => {}, close: () => {} });
    inspector.open('saw', document.querySelector('[data-owned-ability]'));
  });
  for (const [width,height] of [[1440,900],[390,844],[320,568],[844,390],[568,320]]) {
    await page.setViewportSize({ width,height });
    assert.equal(await page.locator('[data-inspect]').count(), 7);
    for (const [id,name] of [['armor','Steel Plating'],['lightning','Chain Lightning'],['saw','Scrap Cyclone']]) {
      await page.locator(`[data-inspect="${id}"]`).click();
      assert.equal(await page.locator('#build-inspector-detail h3').innerText(), name);
      assert.equal(await page.locator(`[data-inspect="${id}"]`).getAttribute('aria-pressed'), 'true');
    }
    await page.waitForFunction(() => [...document.querySelectorAll('#build-inspector img')].every(img => img.complete && img.naturalWidth > 0));
    const layout = await page.locator('#build-inspector').evaluate(el => {
      const r=el.getBoundingClientRect();
      return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight && el.scrollWidth<=el.clientWidth;
    });
    assert.equal(layout,true, `${width}x${height}`);
    await page.screenshot({ path: `.impeccable/review/build-inspector-${width}.png` });
  }
  await page.locator('.build-inspector-close').click();
  assert.equal(await page.locator('#build-inspector').evaluate(el => el.open),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: live click/keyboard opening, owned-only list, frozen solo run, focus/escape/resume, unchanged upgrades, seven-skill selection and five responsive layouts.');
} finally { await browser.close(); }
