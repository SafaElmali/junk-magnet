// npx tsx scripts/landing-language-browser.ts, against a production build (npm run serve).
// Landing page languages: device defaults, exact copy in all six languages, the
// switcher by pointer and keyboard, the shared choice with /play/, and layouts.
import { chromium, type Page } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { LANGUAGES, type Language } from "../src/languages";
import { landingCopy } from "../src/site/landing-locales";
import { chooseMenuLanguage } from "./language-controls.mjs";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5185";
const review = ".impeccable/review";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report: Record<string, unknown> = {};

type Copy = { lang: string; title: string; texts: string[]; labels: string[]; toggle: string };
async function open(page: Page) {
  await page.goto(url);
  await page.locator(".language:not([hidden])").waitFor();
}
// Text outside SVGs and the switcher (native names), labels outside the toggle.
const readCopy = (page: Page): Promise<Copy> =>
  page.evaluate(() => {
    const texts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.data.trim() && !node.parentElement!.closest("svg, .language"))
        texts.push(node.data.trim());
    }
    const labels = [...document.querySelectorAll("[alt], [aria-label]")]
      .filter((node) => !node.matches(".language-toggle"))
      .map((node) => node.getAttribute("alt") || node.getAttribute("aria-label")!)
      .filter(Boolean);
    return {
      lang: document.documentElement.lang,
      title: document.title,
      texts,
      labels,
      toggle: document.querySelector(".language-toggle")!.getAttribute("aria-label")!,
    };
  });
function assertCopy(copy: Copy, english: Copy, code: Language) {
  const expected = (source: string) => landingCopy.get(source)?.[code] ?? source;
  assert.equal(copy.lang, code);
  assert.equal(copy.title, expected(english.title));
  assert.deepEqual(copy.texts, english.texts.map(expected), `${code} text`);
  assert.deepEqual(copy.labels, english.labels.map(expected), `${code} labels`);
  const { name } = LANGUAGES.find((language) => language.code === code)!;
  assert.equal(copy.toggle, expected("Language: {language}").replace("{language}", name));
}
const current = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement).dataset.language ?? document.activeElement!.className);
const menuHidden = (page: Page) => page.locator(".language-menu").evaluate((menu) => (menu as HTMLElement).hidden);

try {
  // 1. The device language picks the default; unsupported languages fall back to English.
  let english: Copy | undefined;
  const defaults = [];
  for (const [locale, code] of [
    ["en-US", "en"], ["tr-TR", "tr"], ["de-AT", "de"], ["fr-CA", "fr"],
    ["es-MX", "es"], ["pt-BR", "pt"], ["ja-JP", "en"],
  ] as [string, Language][]) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await open(page);
    const copy = await readCopy(page);
    english ??= copy;
    assertCopy(copy, english, code);
    assert.deepEqual(errors, []);
    defaults.push({ locale, language: code });
    await context.close();
  }
  report.defaults = defaults;

  // 2. Every language by pointer, then the saved choice beats the device and reaches /play/.
  const context = await browser.newContext({ locale: "tr-TR", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  for (const { code } of [...LANGUAGES].reverse()) {
    await page.locator(".language-toggle").click();
    assert.equal(await page.locator(".language-toggle").getAttribute("aria-expanded"), "true");
    await page.locator(`[data-language="${code}"]`).click();
    assertCopy(await readCopy(page), english!, code);
    assert.equal(await menuHidden(page), true);
    assert.equal(await current(page), "language-toggle");
    assert.equal(await page.locator(`[data-language="${code}"]`).getAttribute("aria-pressed"), "true");
  }
  await page.reload();
  await page.locator(".language:not([hidden])").waitFor();
  assert.equal((await readCopy(page)).lang, "en", "Saved English beats the Turkish device");
  await page.locator(".hero .btn-play").click();
  await page.waitForFunction(() => (window as any).__JUNK_MAGNET__, null, { timeout: 60000 });
  assert.equal(await page.locator("html").getAttribute("lang"), "en", "/play/ follows the landing choice");
  await page.locator("#menu-settings").click();
  await chooseMenuLanguage(page, "de");
  await page.goBack();
  await page.waitForFunction(() => document.documentElement.lang === "de");
  assertCopy(await readCopy(page), english!, "de");

  // 3. Keyboard: Enter opens on the current language, arrows move, Escape and Tab close.
  await page.locator(".language-toggle").focus();
  await page.keyboard.press("Enter");
  assert.equal(await current(page), "de");
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle),
    "solid",
    "Keyboard focus is visible",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(await current(page), "fr");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await current(page), "tr");
  await page.keyboard.press("Escape");
  assert.equal(await menuHidden(page), true);
  assert.equal(await current(page), "language-toggle");
  await page.keyboard.press("Enter");
  const after = LANGUAGES.length - LANGUAGES.findIndex(({ code }) => code === "de");
  for (let step = 0; step < after; step++) await page.keyboard.press("Tab");
  assert.equal(await menuHidden(page), true, "Tabbing past the last language closes the menu");
  await page.locator(".language-toggle").click();
  await page.locator(".hero h1").click();
  assert.equal(await menuHidden(page), true, "Pressing elsewhere closes the menu");
  await page.locator(".language-toggle").click();
  await page.screenshot({ path: `${review}/landing-language-1440-open.png` });
  assert.deepEqual(errors, []);
  report.interactions = { pointer: true, savedBeatsDevice: true, playFollows: true, backFollowsGame: true, keyboard: true };
  await context.close();

  // 4. Layouts: nothing overflows, overlaps or leaves the viewport in any language.
  const layouts = [];
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 },
    { width: 481, height: 900 }, { width: 480, height: 900 }, { width: 390, height: 844 },
    { width: 360, height: 740 }, { width: 320, height: 568 }, { width: 844, height: 390 },
    { width: 568, height: 320 },
  ]) {
    const touch = viewport.width < 1024;
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await open(page);
    for (const { code } of LANGUAGES) {
      await page.evaluate((code) => localStorage.setItem("junk-magnet-language", code), code);
      await page.reload();
      await page.locator(".language:not([hidden])").waitFor();
      // No named functions inside evaluate: tsx wraps them in a __name() helper that
      // does not exist in the page.
      const layout = await page.evaluate(() => {
        const header = [...document.querySelectorAll(".topbar .brand, .topbar nav a, .language-toggle")].map(
          (node) => node.getBoundingClientRect(),
        );
        const overlaps = header.flatMap((p, i) =>
          header.slice(i + 1).filter((q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom),
        ).length;
        const hero = document.querySelector(innerWidth <= 860 ? ".hero-robot" : ".hero-copy .eyebrow")!;
        const heroTop = hero.getBoundingClientRect().top;
        const toggle = document.querySelector<HTMLButtonElement>(".language-toggle")!;
        const { right, bottom } = toggle.getBoundingClientRect();
        const hit = document.elementFromPoint(right + 3, bottom + 3);
        toggle.click();
        const menu = document.querySelector(".language-menu")!.getBoundingClientRect();
        const option = document.querySelector(".language-option")!.getBoundingClientRect();
        const labelsFit = [...document.querySelectorAll(".language-option")].every(
          (node) => node.scrollWidth <= node.clientWidth,
        );
        const scrolled = scrollY > 0;
        toggle.click();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          offscreen: header.some((box) => box.left < 0 || box.right > innerWidth),
          overlaps,
          headerBottom: Math.max(...header.map((box) => box.bottom)),
          heroTop,
          touchTarget: toggle.contains(hit),
          // All six languages are visible at once, without scrolling to the current one.
          menuInside: !scrolled && menu.left >= 0 && menu.right <= innerWidth && menu.bottom <= innerHeight,
          labelsFit,
          optionHeight: option.height,
        };
      });
      assert.equal(layout.overflow, false, `${viewport.width}×${viewport.height} ${code}: page overflow`);
      assert.equal(layout.offscreen, false, `${viewport.width}×${viewport.height} ${code}: offscreen header`);
      assert.equal(layout.overlaps, 0, `${viewport.width}×${viewport.height} ${code}: header overlap`);
      assert.ok(layout.headerBottom <= layout.heroTop, `${viewport.width}×${viewport.height} ${code}: header covers hero`);
      assert.ok(layout.menuInside, `${viewport.width}×${viewport.height} ${code}: menu outside viewport`);
      assert.ok(layout.labelsFit, `${viewport.width}×${viewport.height} ${code}: language name overflows`);
      if (touch) {
        assert.ok(layout.touchTarget, `${viewport.width}×${viewport.height} ${code}: toggle hit area`);
        assert.ok(layout.optionHeight >= 48, `${viewport.width}×${viewport.height} ${code}: option height`);
      }
      layouts.push({ ...viewport, language: code, ...layout });
      // German has the longest copy.
      if (code === "de" && [390, 320, 568].includes(viewport.width)) {
        await page.locator(".language-toggle").click();
        await page.screenshot({ path: `${review}/landing-language-${viewport.width}x${viewport.height}-de.png` });
        await page.keyboard.press("Escape");
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  report.layouts = layouts;
  await fs.writeFile(`${review}/landing-language.json`, JSON.stringify(report, null, 2));
  console.log(`PASS ${defaults.length} device defaults, pointer/keyboard/game hand-off, ${layouts.length} layouts`);
} finally {
  await browser.close();
}
