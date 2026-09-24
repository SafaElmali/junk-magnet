// Layout-only fixtures: real card renderer and translations in an isolated page.
// No game main module is imported, and no live gameplay state is mutated.
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const output = ".impeccable/review/specializations";
const url = process.env.GAME_URL ?? process.argv[2] ?? "http://127.0.0.1:5185";
await fs.mkdir(output, { recursive: true });
const bundled = await build({
  stdin: {
    contents: `
      import '@fontsource/barlow-condensed/latin-700.css';
      import '@fontsource/barlow-condensed/latin-800.css';
      import '@fontsource/dm-sans/latin-400.css';
      import '@fontsource/dm-sans/latin-500.css';
      import '@fontsource/dm-sans/latin-700.css';
      import '@fontsource/barlow-condensed/latin-ext-700.css';
      import '@fontsource/barlow-condensed/latin-ext-800.css';
      import '@fontsource/dm-sans/latin-ext-400.css';
      import '@fontsource/dm-sans/latin-ext-500.css';
      import '@fontsource/dm-sans/latin-ext-700.css';
      import './src/style.css';
      import './src/play-hud.css';
      import './src/menu.css';
      import './src/help-art.css';
      import './src/pause-menu.css';
      import './src/opening-guide.css';
      import './src/result-menu.css';
      import './src/loading-screen.css';
      import './src/expansion.css';
      import './src/level-up.css';
      import { createState } from './src/simulation';
      import { upgradeChoicesMarkup } from './src/level-up';
      import { setLanguage, t } from './src/i18n';
      import { weaponBranches } from './src/specializations';
      import { specializationHeading } from './src/specialization-ui';
      window.renderSpecializationFixture = (language, weapon) => {
        setLanguage(language);
        const state = createState();
        state.phase = 'upgrade';
        state.specializationChoices = weaponBranches(weapon);
        const [heading, copy] = specializationHeading();
        document.querySelector('#upgrade-title').textContent = heading;
        document.querySelector('#upgrade-copy').textContent = copy;
        document.querySelector('#upgrade-choices').innerHTML = upgradeChoicesMarkup(state);
        document.querySelector('.upgrade-note').textContent = t('Choose with 1, 2, or 3 · Your other abilities keep their upgrades.');
        document.documentElement.lang = language;
      };
    `,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, write: false, outfile: "layout-fixture.js", format: "iife", define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
});
const js = bundled.outputFiles.find(file => file.path.endsWith(".js")).text;
const css = bundled.outputFiles.find(file => file.path.endsWith(".css")).text;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Specialization layout fixture</title></head><body><main id="app" class="in-run" data-phase="upgrade"><div id="yard"><div class="upgrade" id="upgrade" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><div class="upgrade-sheet"><header class="upgrade-heading"><span class="upgrade-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m14 2-9 12h7l-2 8 9-12h-7z"/></svg></span><div><h2 id="upgrade-title"></h2><p id="upgrade-copy"></p></div></header><div id="upgrade-choices" class="upgrade-choices"></div><p class="upgrade-note"></p></div></div></div></main><aside style="position:fixed;top:3px;left:5px;z-index:999;color:white;font:10px sans-serif">LAYOUT FIXTURE · no gameplay</aside></body></html>`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [], failures = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__specialization_fixture__", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto(`${url}/__specialization_fixture__`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  for (const [width, height] of [[320, 568], [568, 320]]) {
    await page.setViewportSize({ width, height });
    for (const language of ["en", "tr", "de", "fr", "es", "pt"]) {
      for (const weapon of ["saw", "lightning", "turret", "burst", "harpoon", "slag"]) {
        await page.evaluate(({ language, weapon }) => window.renderSpecializationFixture(language, weapon), { language, weapon });
        await page.evaluate(() => document.fonts.ready);
        const bounds = await page.locator(".upgrade-sheet").evaluate(sheet => {
          const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
          return {
            sheet: rect(sheet), scroll: sheet.scrollHeight, client: sheet.clientHeight,
            cards: [...sheet.querySelectorAll("[data-specialization]")].map(card => ({
              branch: card.getAttribute("data-specialization"), ...rect(card),
              overflow: [...card.querySelectorAll("strong,.upgrade-rank,.upgrade-description")].filter(el => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent),
            })),
          };
        });
        const entry = { language, weapon, width, height, bounds };
        report.push(entry);
        if (bounds.scroll > bounds.client + 2 || bounds.sheet.x < -1 || bounds.sheet.right > width + 1 || bounds.sheet.bottom > height + 1 || bounds.cards.length !== 2 || bounds.cards.some(card => card.y < 0 || card.bottom > height + 1 || card.x < 0 || card.right > width + 1 || card.overflow.length)) failures.push(entry);
        await page.screenshot({ path: `${output}/${language}-${weapon}-${width}x${height}-fixture.png` });
      }
    }
  }
  await fs.writeFile(`${output}/report.json`, JSON.stringify({ layoutOnly: true, report, failures, errors }, null, 2));
  console.log(JSON.stringify({ fixtures: report.length, branches: 12, languages: 6, failures, errors }));
  assert.deepEqual(errors, []);
  assert.equal(failures.length, 0, `Layout overflow: see ${output}/report.json`);
} finally { await browser.close(); }
