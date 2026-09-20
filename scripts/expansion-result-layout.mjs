// Explicit layout fixtures: real result markup/styles/helper, representative completed-run values.
// These captures do not claim a naturally completed run.
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5184");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.evaluate(() => {
    document.querySelector("#intro").classList.add("hidden");
    document.querySelector("#app").classList.remove("in-menu");
    document.querySelector("#app").classList.add("in-run");
    document.querySelector("#result").classList.remove("hidden");
    for (const id of ["help", "pause"])
      document.getElementById(id).style.display = "none";
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
      await page.evaluate(async (code) => {
        const { setLanguage, t } = await import("/src/i18n.ts");
        const { resultBuildMarkup } = await import("/src/result-summary.ts");
        const { createState } = await import("/src/simulation.ts");
        setLanguage(code);
        document.querySelector("#result-build-label").textContent =
          t("YOUR BUILD");
        document.querySelector("#again span").textContent = t("ONE MORE SHIFT");
        document.querySelector("#result-menu span").textContent =
          t("MAIN MENU");
        document
          .querySelectorAll(".result-stats > div > span > span")
          .forEach(
            (el, i) =>
              (el.textContent = t(
                ["SHIFT TIME", "RECYCLED ENEMIES", "LEVEL REACHED"][i],
              )),
          );
        const s = createState();
        s.time = 169;
        s.evolutions = { vortex: true, storm: true, fortress: true };
        document.querySelector("#result-reward").textContent = t(
          "+{parts} parts · Bank: {total}",
          { parts: 138, total: 999999 },
        );
        s.kills = 223;
        s.level = 9;
        Object.assign(s.upgrades, {
          saw: 5,
          lightning: 5,
          turret: 5,
          burst: 2,
          boots: 2,
          magnet: 2,
          armor: 2,
        });
        document.querySelector("#result-stamp").textContent = t(
          "BACK TO THE WORKSHOP",
        );
        document.querySelector("#result-title").textContent =
          t("SHIFT COMPLETE");
        document.querySelector("#result-copy").textContent = t(
          "The swarm got this shift. {launches} scrap launches made it count.",
          { launches: 100 },
        );
        document.querySelector("#result-time").textContent = "02:49";
        document.querySelector("#result-kills").textContent = "223";
        document.querySelector("#result-level").textContent = "9";
        document.querySelector("#result-build").innerHTML =
          resultBuildMarkup(s);
      }, code);
      await page.waitForFunction(() =>
        [...document.querySelectorAll("#result-build img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      const issues = await page.evaluate(() => {
        const root = document.querySelector("#result .modal-card");
        const r = root.getBoundingClientRect();
        const a = [];
        if (
          root.scrollHeight > root.clientHeight + 2 ||
          root.scrollWidth > root.clientWidth + 2
        )
          a.push(
            `overflow ${root.scrollWidth}x${root.scrollHeight}/${root.clientWidth}x${root.clientHeight}`,
          );
        for (const el of root.querySelectorAll(
          "button,h2,h3,.result-module,.result-module>span,.result-stats>div",
        )) {
          if (!el.getClientRects().length) continue;
          const b = el.getBoundingClientRect();
          if (
            b.top < 0 ||
            b.bottom > innerHeight + 1 ||
            b.left < 0 ||
            b.right > innerWidth + 1 ||
            b.bottom > r.bottom + 1
          )
            a.push(`${el.id || el.className} clipped`);
        }
        return a;
      });
      if (issues.length)
        await page.screenshot({
          path: ".impeccable/review/expansion-result-layout-failure.png",
        });
      assert.deepEqual(issues, [], `${width}x${height} ${code}`);
      assert.equal(await page.locator(".result-module").count(), 7);
      if (code === "tr")
        await page.screenshot({
          path: `.impeccable/review/expansion-result-layout-fixture-${width}x${height}.png`,
        });
      report.push({
        width,
        height,
        language: code,
        modules: 7,
        noOverflow: true,
      });
    }
    console.log(`PASS ${width}x${height}, six languages`);
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    ".impeccable/review/expansion-result-layout.json",
    JSON.stringify({ fixture: true, cases: report, errors }, null, 2),
  );
} finally {
  await browser.close();
}
