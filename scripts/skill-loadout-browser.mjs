// Layout fixtures use the production markup with a separate sample state.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const page = await browser.newPage({ locale: "en-US" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5186/play/");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.locator("#start").click();
  await page.waitForFunction(() => document.querySelectorAll('.ability-chip img').length > 0);
  assert.equal(await page.locator('.ability-chip').count(), Object.values(await page.evaluate(() => window.__JUNK_MAGNET__.snapshot().upgrades)).filter(rank => rank > 0).length);
  await page.locator("#pause").click();
  await page.addStyleTag({ content: '#boss-hud.hidden{display:block!important}.ability-loadout,.hud{visibility:visible!important}#modal{display:none!important}.in-run .top-progress{display:block!important}.in-run .masthead{top:calc(max(10px, env(safe-area-inset-top)) + 26px)!important}.in-run .masthead .icon-btn:not(#pause){display:none!important}' });
  for (const [width, height] of [[1440,900],[390,844],[320,568],[844,390],[568,320]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => {
      const { abilityLoadoutMarkup } = await import('/src/ability-loadout.ts');
      const { createState } = await import('/src/simulation.ts');
      const state = createState();
      Object.assign(state.upgrades, { saw: 5, lightning: 2, turret: 3, burst: 1, boots: 4, magnet: 2, armor: 1, repair: 1 });
      state.evolutions.vortex = true;
      document.querySelector('#ability-loadout').innerHTML = abilityLoadoutMarkup(state);
      document.querySelector('#boss-name').textContent = 'Scrapyard Colossus';
    });
    await page.waitForFunction(() => [...document.querySelectorAll('.ability-chip img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('.ability-chip').count(), 7);
    assert.equal(await page.locator('.ability-chip.is-evolved').count(), 1);
    assert.equal(await page.locator('.ability-chip').first().getAttribute('aria-label'), 'Scrap Cyclone, rank 5');
    assert.equal(await page.locator('.ability-chip-ranks .is-filled').count(), 18);
    const layout = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.ability-chip')].map(el => el.getBoundingClientRect());
      const boss = document.querySelector('#boss-hud').getBoundingClientRect();
      const pause = document.querySelector('#pause').getBoundingClientRect();
      const overlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        inside: chips.every(r => r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight),
        oneRow: chips.every(r => r.top === chips[0].top),
        overlapsBoss: chips.some(r => overlap(r, boss)),
        overlapsPause: chips.some(r => overlap(r, pause)),
        overlappingTiles: chips.some((r,i) => chips.slice(i+1).some(other => overlap(r,other))),
      };
    });
    assert.deepEqual(layout, { inside:true, oneRow:true, overlapsBoss:false, overlapsPause:false, overlappingTiles:false });
    await page.screenshot({ path: `.impeccable/review/skill-loadout-${width}.png` });
    results.push({ width, height, ...layout });
  }
  assert.deepEqual(errors, []);
  await fs.writeFile('.impeccable/review/skill-loadout.json', JSON.stringify(results,null,2));
  console.log('PASS: seven illustrated skills, rank marks, evolved state, and five responsive HUD layouts.');
} finally {
  await browser.close();
}
