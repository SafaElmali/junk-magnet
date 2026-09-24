import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

await fs.mkdir("/tmp/junk-magnet-audio", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.GAME_URL ?? "http://127.0.0.1:5185/play/";
const reports = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
    [568, 320],
  ].filter(
    ([width]) =>
      !process.env.AUDIO_VIEWPORT ||
      width === Number(process.env.AUDIO_VIEWPORT),
  )) {
    const page = await browser.newPage({
      viewport: { width, height },
      locale: width === 568 ? "de-DE" : "en-US",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      // Inspect the real mixed output, not a mocked player or silent audio context.
      const original = AudioContext.prototype.createDynamicsCompressor;
      AudioContext.prototype.createDynamicsCompressor = function () {
        const compressor = original.call(this);
        const analyser = this.createAnalyser();
        analyser.fftSize = 2048;
        compressor.connect(analyser);
        window.__audioRms = () => {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          return Math.sqrt(
            data.reduce((sum, value) => sum + value * value, 0) / data.length,
          );
        };
        return compressor;
      };
    });
    const state = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal((await state()).audio.state, "locked");
    assert.equal((await state()).audio.enabled, true);
    assert.equal((await state()).audio.music, true);
    assert.equal(
      await page.locator(".home-audio, #home-sound, #home-music").count(),
      0,
    );
    await page.locator("#menu-settings").click();
    for (const button of await page
      .locator(".audio-settings-controls button, .audio-volume-bar")
      .all()) {
      const box = await button.boundingBox();
      assert.ok(
        box &&
          box.y >= 0 &&
          box.y + box.height <= height &&
          box.x >= 0 &&
          box.x + box.width <= width,
        `settings control ${await button.getAttribute("id")} fits ${width}x${height}: ${JSON.stringify(box)}`,
      );
      assert.ok(
        await button.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
        "settings controls are not covered",
      );
    }
    await page.screenshot({
      path: `/tmp/junk-magnet-audio/settings-${width}.png`,
    });
    if (process.env.AUDIO_LAYOUT_ONLY) {
      const musicBar = page.locator("#menu-music-volume");
      const box = await musicBar.boundingBox();
      await musicBar.click({
        position: { x: box.width / 2, y: box.height / 2 },
      });
      assert.equal((await state()).audio.musicVolume, 50);
      assert.equal((await state()).audio.effectsVolume, 50);
      await musicBar.press("ArrowRight");
      assert.equal((await state()).audio.musicVolume, 51);
      assert.equal(await page.locator("#menu-music-value").innerText(), "51%");
      assert.equal(await musicBar.getAttribute("aria-valuetext"), "51%");
      await musicBar.press("Home");
      assert.equal((await state()).audio.musicVolume, 0);
      await musicBar.press("End");
      assert.equal((await state()).audio.musicVolume, 100);
      const soundBar = page.locator("#menu-sound-volume");
      await soundBar.press("Home");
      await soundBar.press("ArrowRight");
      assert.equal((await state()).audio.effectsVolume, 1);
      assert.equal((await state()).audio.musicVolume, 100);
      await page.reload();
      await page.waitForFunction(() => window.__JUNK_MAGNET__);
      assert.equal((await state()).audio.musicVolume, 100);
      assert.equal((await state()).audio.effectsVolume, 1);
      reports.push({
        width,
        height,
        settingsControls: true,
        noHomepageControls: true,
        sliders: "pointer + keyboard + persisted independent levels",
      });
      await page.close();
      continue;
    }
    await page.locator("#menu-sound").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.loaded === 24,
    );
    assert.deepEqual((await state()).audio.failed, []);
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    assert.equal(
      (await state()).audio.enabled,
      false,
      "music plays with effects disabled",
    );
    const musicRms = await page.evaluate(() => window.__audioRms());
    await page.locator("#menu-music").click();
    await page.waitForTimeout(1800);
    assert.ok(await page.evaluate(() => window.__audioRms() < 0.0001));
    await page.locator("#menu-music").click();
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    for (let i = 0; i < 6; i++) await page.locator("#menu-music-down").click();
    assert.equal((await state()).audio.musicVolume, 0);
    assert.ok(await page.locator("#menu-music-down").isDisabled());
    await page.waitForTimeout(1800);
    assert.ok(
      await page.evaluate(() => window.__audioRms() < 0.0001),
      "zero music volume silences its bus",
    );
    for (let i = 0; i < 6; i++) await page.locator("#menu-music-up").click();
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    await page.locator("#menu-sound-down").click();
    assert.equal((await state()).audio.effectsVolume, 40);
    assert.equal((await state()).audio.musicVolume, 60);
    assert.equal(await page.locator("#menu-sound-value").innerText(), "40%");
    assert.equal(
      (await state()).audio.enabled,
      false,
      "volume preserves the mute preference",
    );
    await page.reload();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal((await state()).audio.effectsVolume, 40);
    assert.equal((await state()).audio.musicVolume, 60);
    assert.equal((await state()).audio.enabled, false);
    assert.equal((await state()).audio.music, true);
    await page.locator("#menu-settings").click();
    await page.locator("#menu-sound").click();
    await page.locator("#menu-sound-up").click();
    assert.ok(await page.locator("#menu-music").isEnabled());
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.loaded === 24,
    );
    const musicBox = await page.locator("#menu-music").boundingBox();
    assert.ok(
      musicBox.y >= 0 && musicBox.y + musicBox.height <= height,
      "music control fits viewport",
    );
    assert.ok(
      await page.locator("#menu-music").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
      "music control is not covered by another panel",
    );
    if (width === 844)
      await page.screenshot({
        path: "/tmp/junk-magnet-audio/settings-landscape.png",
      });
    await page.locator("#menu-music").click();
    await page.waitForTimeout(1800);
    assert.ok(
      await page.evaluate(() => window.__audioRms() < 0.0001),
      "music OFF silences the soundtrack",
    );
    await page.locator("#menu-back").click();
    await page.locator("#start").click();
    const before = (await state()).audio.played;
    await page.waitForFunction(
      (n) => window.__JUNK_MAGNET__.snapshot().audio.played > n + 3,
      before,
    );
    assert.equal(
      (await state()).audio.music,
      false,
      "effects continue with music disabled",
    );
    assert.ok((await state()).audio.voices <= 16);
    await page.locator("#pause").click();
    await page.waitForTimeout(600);
    assert.equal((await state()).audio.mode, "paused");
    assert.equal((await state()).audio.voices, 0);
    await page.locator("#pause-menu").click();
    await page.locator("#menu-settings").click();
    await page.locator("#menu-music").click();
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    await page.locator("#menu-back").click();
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    await page.locator("#pause").click();
    await page.waitForTimeout(2000);
    assert.ok(
      await page.evaluate(() => window.__audioRms() < 0.0001),
      "pause fades the enabled gameplay soundtrack to silence",
    );
    await page.locator("#resume").click();
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    await page.locator("#pause").click();
    await page.locator("#pause-menu").click();
    await page.locator("#menu-settings").click();
    await page.locator("#menu-sound").click();
    assert.equal((await state()).audio.enabled, false);
    assert.equal((await state()).audio.music, true);
    await page.waitForFunction(() => window.__audioRms() > 0.001);
    assert.ok(await page.locator("#menu-music").isEnabled());
    await page.locator("#menu-music").click();
    await page.waitForTimeout(1800);
    assert.ok(
      await page.evaluate(() => window.__audioRms() < 0.0001),
      "both toggles OFF silence output",
    );
    await page.reload();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal((await state()).audio.enabled, false, "effects mute persists");
    await page.locator("#menu-settings").click();
    await page.locator("#menu-sound").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.loaded === 24,
    );
    await page.reload();
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    assert.equal(
      (await state()).audio.music,
      false,
      "music preference persists independently",
    );
    assert.equal((await state()).audio.enabled, true);
    await page.locator("#menu-settings").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.state === "running",
    );
    // A visibility fixture triggers the same handler used by app/tab switching.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.state === "suspended",
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator("#menu-back").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.state === "running",
    );
    assert.deepEqual(errors, []);
    reports.push({
      width,
      height,
      decoded: 24,
      musicRms,
      playback: true,
      mute: true,
      pause: true,
      persistence: true,
      visibilityFixture: true,
      errors,
    });
    await page.close();
  }
  // Exercise fallback decoding and a missing effect independently of normal playback.
  for (const missingEffect of process.env.AUDIO_LAYOUT_ONLY
    ? []
    : [false, true]) {
    const page = await browser.newPage();
    let mp3Requests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith(".mp3")) mp3Requests++;
    });
    await page.route("**/audio/*.ogg", (route) =>
      route.fulfill({ body: "unsupported codec fixture" }),
    );
    if (missingEffect)
      await page.route("**/audio/hurt.wav", (route) =>
        route.fulfill({ status: 404, body: "missing asset fixture" }),
      );
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__);
    await page.locator("#menu-settings").click();
    await page.waitForFunction(
      (count) => window.__JUNK_MAGNET__.snapshot().audio.loaded === count,
      missingEffect ? 23 : 24,
    );
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().audio.tracks.length === 2,
    );
    assert.equal(mp3Requests, 2, "both music loops fall back to MP3");
    const audio = await page.evaluate(
      () => window.__JUNK_MAGNET__.snapshot().audio,
    );
    assert.deepEqual(audio.failed, missingEffect ? ["hurt"] : []);
    await page.locator("#menu-back").click();
    await page.locator("#start").click();
    await page.waitForFunction(
      () => window.__JUNK_MAGNET__.snapshot().time > 0.5,
    );
    reports.push({ mp3Fallback: true, missingEffect, gameplayContinues: true });
    await page.close();
  }
  await fs.writeFile(
    "/tmp/junk-magnet-audio-browser.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
