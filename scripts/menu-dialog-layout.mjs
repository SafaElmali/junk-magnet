// UI layout fixtures for long copy. Does not claim to simulate a completed run.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 320, height: 568 },
  locale: "tr-TR",
  isMobile: true,
  hasTouch: true,
});
const report = [];
try {
  await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5185/play/");
  await page.waitForFunction(() => window.__JUNK_MAGNET__);
  await page.evaluate(() => {
    document.querySelector("#app").classList.remove("in-menu");
    document.querySelector("#app").classList.add("in-run");
    document.querySelector("#intro").classList.add("hidden");
    document.querySelector("#upgrade").classList.remove("hidden");
    document.querySelector("#upgrade-copy").textContent =
      "Seviye 99 · Bir yetenek seç.";
    document.querySelector("#upgrade-choices").innerHTML = [
      "lightning",
      "turret",
      "overclock",
    ]
      .map(
        (id, i) =>
          `<button class="upgrade-choice"><span class="upgrade-icon"><img class="ability-art" src="./abilities/${id}.png"></span><span class="upgrade-text"><span class="upgrade-rank">YENİ YETENEK</span><strong>${["Zincir Şimşek", "Hurda Tareti", "Aşırı Güç"][i]}</strong><span class="upgrade-description">20 saniye boyunca +%25 hasar ve +%15 hareket hızı. Tekrar seçmek süreyi yeniler.</span></span><kbd>${i + 1}</kbd></button>`,
      )
      .join("");
  });
  for (const type of ["upgrade", "result"]) {
    if (type === "result")
      await page.evaluate(() => {
        document.querySelector("#upgrade").classList.add("hidden");
        document.querySelector("#result").classList.remove("hidden");
        document.querySelector("#result-title").textContent =
          "Biraz ezildik. Pes etmedik.";
        document.querySelector("#result-copy").textContent =
          "Bu vardiyada sürü kazandı. 999 kez hurda fırlatarak karşılık verdin.";
        document.querySelector("#result-time").textContent = "59:59";
        document.querySelector("#result-kills").textContent = "9999";
        document.querySelector("#result-level").textContent = "99";
        document.querySelector("#result-build").textContent =
          "Yeteneklerin: Yörünge Testereleri 5 · Zincir Şimşek 5 · Hurda Tareti 5 · Manyetik Patlama 5 · Turbo Paletler 4 · Toplayıcı Mıknatıs 4 · Çelik Zırh 4";
      });
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [568, 320],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      const bounds = await page
        .locator(type === "upgrade" ? ".upgrade-sheet" : "#result .modal-card")
        .evaluate((el) => ({
          scroll: el.scrollHeight,
          client: el.clientHeight,
          buttons: [...el.querySelectorAll("button")].map((b) => ({
            bottom: b.getBoundingClientRect().bottom,
            top: b.getBoundingClientRect().top,
          })),
        }));
      assert.ok(
        bounds.scroll <= bounds.client + 2,
        `${type} ${width}x${height} ${JSON.stringify(bounds)}`,
      );
      assert.ok(bounds.buttons.every((b) => b.top >= 0 && b.bottom <= height));
      await page.screenshot({
        path: `.impeccable/review/fixed-${type}-fixture-${width}x${height}.png`,
      });
      report.push({ type, width, height, bounds });
    }
  }
  console.log(JSON.stringify(report));
  await fs.writeFile(
    ".impeccable/review/fixed-dialog-fixtures.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
