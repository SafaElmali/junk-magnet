import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const [width, height] of [
    [320, 568],
    [568, 320],
  ]) {
    for (const language of ["en", "tr", "de", "fr", "es", "pt"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        locale: language,
        hasTouch: true,
        isMobile: true,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185/play/");
      await page.waitForFunction(() => window.__JUNK_MAGNET__);
      assert.equal(await page.locator("html").getAttribute("lang"), language);
      await page.locator("#start").click();
      const stages = [];
      for (const stage of ["collect", "orbit"]) {
        await page.waitForFunction(
          (phase) =>
            document.querySelector("#opening-guide").dataset.step === phase &&
            window.__JUNK_MAGNET__.snapshot().phase === "playing",
          stage,
        );
        const layout = await page.evaluate(() => {
          const guide = document.querySelector("#opening-guide");
          const copy = document.querySelector("#opening-copy");
          const box = guide.getBoundingClientRect();
          const text = copy.getBoundingClientRect();
          const stick = document
            .querySelector("#touch-stick")
            .getBoundingClientRect();
          const health = document
            .querySelector("#yard > .health-track")
            .getBoundingClientRect();
          const overlaps = (a, b) =>
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          return {
            copy: copy.textContent,
            time: window.__JUNK_MAGNET__.snapshot().time,
            openingRemaining:
              window.__JUNK_MAGNET__.snapshot().openingRemaining,
            viewportFits:
              box.left >= 0 &&
              box.top >= 0 &&
              box.right <= innerWidth + 1 &&
              box.bottom <= innerHeight + 1,
            textFits:
              text.left >= box.left &&
              text.right <= box.right &&
              text.top >= box.top &&
              text.bottom <= box.bottom &&
              copy.scrollWidth <= copy.clientWidth + 1 &&
              guide.scrollWidth <= guide.clientWidth + 1,
            joystickClear: !overlaps(box, stick),
            healthClear: !overlaps(box, health),
            pointerEvents: getComputedStyle(guide).pointerEvents,
            height: box.height,
          };
        });
        for (const key of [
          "viewportFits",
          "textFits",
          "joystickClear",
          "healthClear",
        ])
          assert.ok(
            layout[key],
            `${language} ${width}x${height} ${stage} ${key}: ${JSON.stringify(layout)}`,
          );
        assert.equal(layout.pointerEvents, "none");
        if (language === "fr")
          await page.screenshot({
            path: `.impeccable/review/opening-guide-fr-${width}-${stage}.png`,
          });
        stages.push({ stage, ...layout });
      }
      assert.deepEqual(errors, []);
      reports.push({ width, height, language, stages, errors });
      await page.close();
      console.log(`PASS opening guide ${language} ${width}x${height}`);
    }
  }
  await fs.writeFile(
    ".impeccable/review/opening-guide-layout.json",
    JSON.stringify(
      {
        type: "Actual fresh-start browser runs; no DOM gameplay fixtures.",
        reports,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
