// Explicit layout fixtures using the same choice renderer as production.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "tr-TR",
  });
  await page.goto("http://127.0.0.1:5184");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.evaluate(() => {
    document.querySelector("#intro").classList.add("hidden");
    document.querySelector("#app").classList.replace("in-menu", "in-run");
    document.querySelector("#upgrade").classList.remove("hidden");
  });
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
    [568, 320],
  ]) {
    await page.setViewportSize({ width, height });
    for (const code of ["tr", "en", "de", "fr", "es", "pt"]) {
      for (const ids of [
        ["lightning", "turret", "overclock"],
        ["saw", "armor", "magnet"],
        ["repair", "refill", "boots"],
        ["burst", "lightning", "turret"],
      ]) {
        await page.evaluate(
          async ({ code, ids }) => {
            const { setLanguage, t } = await import("/src/i18n.ts");
            const { createState } = await import("/src/simulation.ts");
            const { upgradeChoicesMarkup } = await import("/src/level-up.ts");
            setLanguage(code);
            const s = createState();
            s.level = 25;
            s.hp = 23;
            s.choices = ids;
            if (ids[0] === "saw")
              Object.assign(s.upgrades, { saw: 4, armor: 3, magnet: 3 });
            document.querySelector("#upgrade-title").textContent =
              t("Level up");
            document.querySelector("#upgrade-copy").textContent = t(
              "Level {level} · Choose one upgrade.",
              { level: 25 },
            );
            document.querySelector("#upgrade-choices").innerHTML =
              upgradeChoicesMarkup(s);
            document.querySelector(".upgrade-note").textContent = t(
              "Choose with 1, 2, or 3 · Your other abilities keep their upgrades.",
            );
            document.querySelector(".upgrade-choice").focus();
          },
          { code, ids },
        );
        await page.waitForFunction(() =>
          [...document.querySelectorAll("#upgrade img")].every(
            (i) => i.complete && i.naturalWidth,
          ),
        );
        const issues = await page.evaluate(() => {
          const panel = document.querySelector(".upgrade-sheet"),
            r = panel.getBoundingClientRect();
          const out = [];
          if (
            panel.scrollHeight > panel.clientHeight + 1 ||
            panel.scrollWidth > panel.clientWidth + 1
          )
            out.push(
              `paneloverflow ${panel.scrollHeight}/${panel.clientHeight}`,
            );
          for (const el of document.querySelectorAll(
            "#upgrade button,#upgrade .upgrade-description,#upgrade .upgrade-name-row,#upgrade img",
          )) {
            const b = el.getBoundingClientRect();
            if (
              b.x < r.x ||
              b.right > r.right + 1 ||
              b.y < r.y ||
              b.bottom > r.bottom + 1 ||
              b.bottom > innerHeight
            )
              out.push(el.className + " clipped");
            if (el.scrollWidth > el.clientWidth + 1)
              out.push(el.className + " horizontal overflow");
          }
          return out;
        });
        if (issues.length)
          await page.screenshot({
            path: ".impeccable/review/level-up-failure.png",
          });
        assert.deepEqual(issues, [], `${width}x${height} ${code} ${ids}`);
        report.push({ width, height, code, ids, issues });
        if (code === "tr" && ids[0] === "lightning")
          await page.screenshot({
            path: `.impeccable/review/level-up-fixture-${width}.png`,
          });
      }
    }
    console.log(`PASS ${width}x${height} six languages, all choices`);
  }
  await fs.writeFile(
    ".impeccable/review/level-up-layout.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
