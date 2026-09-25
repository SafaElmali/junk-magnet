// Rewarded-ad offers in the CrazyGames build, against a fake SDK served in place of
// https://sdk.crazygames.com/crazygames-sdk-v3.js. Every defeat is real keyboard play.
//
//   VITE_CRAZYGAMES_ADS=true npm run build:crazygames
//   npx vite preview --outDir dist-crazygames --host 127.0.0.1 --port 5320 --strictPort
//   node scripts/ads-browser.mjs
//
// With a normal `npm run build:crazygames` (ads off), run `ADS=off node scripts/ads-browser.mjs`:
// it checks that a defeat goes straight to results without either offer.
// Screenshots go to SCREENSHOT_DIR or a new temporary folder.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5320";
const adsOff = process.env.ADS === "off";
const out =
  process.env.SCREENSHOT_DIR ??
  (await fs.mkdtemp(path.join(os.tmpdir(), "junk-magnet-ads-")));
const viewports = [
  [1440, 900],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
];
const PROGRESS = "junk-magnet-workshop-v1";
const fixture = { version: 1, parts: 100, completedRuns: 3, bestTime: 60, bestKills: 40 };
const copy = {
  en: {
    title: "Out of power",
    body: "Watch a short ad to revive with 50 health.",
    watch: "WATCH AD",
    decline: "NO THANKS",
    double: "WATCH AD · DOUBLE PARTS",
    doubled: "(doubled)",
    none: "No ad available right now",
  },
  de: {
    title: "Keine Energie mehr",
    body: "Sieh dir kurz Werbung an und mach mit 50 Leben weiter.",
    watch: "WERBUNG ANSEHEN",
    decline: "NEIN, DANKE",
    double: "WERBUNG · TEILE ×2",
    doubled: "(verdoppelt)",
    none: "Gerade keine Werbung verfügbar",
  },
};

/**
 * A stand-in for the CrazyGames SDK v3: records game.* calls, keeps an in-memory Data
 * module and plays rewarded ads as window.__fakeSdk.control says ("finish" after
 * 300 ms, "hold" until finish() is called, or "error" with control.code).
 */
const fakeSdk = (seed) => `(() => {
  const data = new Map(Object.entries(${JSON.stringify(seed)}));
  const calls = [];
  const control = { next: "finish", code: "unfilled", pending: null, requests: 0 };
  window.__fakeSdk = {
    calls,
    control,
    finish() {
      const callbacks = control.pending;
      control.pending = null;
      callbacks?.adFinished?.();
    },
  };
  const record = (name) => () => void calls.push(name);
  window.CrazyGames = { SDK: {
    init: async () => {},
    environment: "crazygames",
    game: {
      loadingStart: record("loadingStart"),
      loadingStop: record("loadingStop"),
      gameplayStart: record("gameplayStart"),
      gameplayStop: record("gameplayStop"),
      settings: { muteAudio: false },
      addSettingsChangeListener: () => {},
    },
    data: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => void data.set(key, String(value)),
      removeItem: (key) => void data.delete(key),
      clear: () => data.clear(),
      key: (i) => [...data.keys()][i] ?? null,
      get length() { return data.size; },
    },
    ad: {
      hasAdblock: async () => false,
      requestAd(type, callbacks) {
        calls.push("requestAd:" + type);
        control.requests++;
        const mode = control.next;
        setTimeout(() => {
          if (mode === "error") return callbacks.adError?.({ code: control.code });
          callbacks.adStarted?.();
          if (mode === "hold") control.pending = callbacks;
          else setTimeout(() => callbacks.adFinished?.(), 300);
        }, 50);
      },
    },
  } };
})();`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];

async function openGame(language) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: language });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://sdk.crazygames.com/crazygames-sdk-v3.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeSdk({ [PROGRESS]: JSON.stringify(fixture) }) }),
  );
  await page.goto(url);
  await page.waitForFunction(() => window.__JUNK_MAGNET__, null, { timeout: 60_000 });
  assert.equal(await page.evaluate(() => window.CrazyGames.SDK.environment), "crazygames");
  await imagesReady(page);
  return { page, errors };
}
const snapshot = (page) => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
const progress = (page) =>
  page.evaluate((key) => JSON.parse(window.CrazyGames.SDK.data.getItem(key)), PROGRESS);
const sdk = (page) =>
  page.evaluate(() => ({ calls: [...window.__fakeSdk.calls], requests: window.__fakeSdk.control.requests }));
const setAd = (page, next, code = "unfilled") =>
  page.evaluate(([next, code]) => Object.assign(window.__fakeSdk.control, { next, code }), [next, code]);
const activeId = (page) => page.evaluate(() => document.activeElement?.id ?? "");
const visible = (page, selector) => page.locator(selector).isVisible();
const imagesReady = (page) =>
  page.waitForFunction(() =>
    [...document.querySelectorAll("#intro img, #result img")]
      .filter((img) => img.getClientRects().length)
      .every((img) => img.complete && img.naturalWidth > 0),
  );

/** Overflow, off-screen and overlap problems among visible elements under `root`. */
const layoutIssues = (page, root) =>
  page.evaluate((root) => {
    const shown = (e) => {
      const r = e.getBoundingClientRect();
      return e.getClientRects().length && r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== "hidden";
    };
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${typeof e.className === "string" && e.className ? `.${e.className.split(" ").join(".")}` : ""}`;
    const issues = [];
    const card = document.querySelector(root);
    if (!card || !shown(card)) return [`${root} is not visible`];
    if (card.scrollHeight > card.clientHeight + 2 || card.scrollWidth > card.clientWidth + 2)
      issues.push(`${name(card)} overflows ${card.scrollWidth}x${card.scrollHeight} > ${card.clientWidth}x${card.clientHeight}`);
    const c = card.getBoundingClientRect();
    for (const e of card.querySelectorAll("button, h2, h3, p, li, strong, .result-reward-text, .result-double-note")) {
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
        issues.push(`${name(e)} off-screen ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`);
      if (r.left < c.left - 1 || r.right > c.right + 1 || r.bottom > c.bottom + 1)
        issues.push(`${name(e)} leaves the card`);
    }
    // Buttons never overlap each other or the reward text.
    const blocks = [...card.querySelectorAll("button, .result-reward-text, .result-double-note, h2, #revive-offer-copy")].filter(shown);
    for (let i = 0; i < blocks.length; i++)
      for (let j = i + 1; j < blocks.length; j++) {
        if (blocks[i].contains(blocks[j]) || blocks[j].contains(blocks[i])) continue;
        const a = blocks[i].getBoundingClientRect(),
          b = blocks[j].getBoundingClientRect();
        const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (overlap > 2) issues.push(`${name(blocks[i])} overlaps ${name(blocks[j])}`);
      }
    return [...new Set(issues)];
  }, root);

/** Walks into the nearest enemy until the robot is defeated, choosing non-repair upgrades. */
async function playUntilDefeated(page) {
  for (let i = 0; i < 2500; i++) {
    const s = await snapshot(page);
    if (s.phase === "lost") return s;
    if (s.phase === "upgrade") {
      await page.locator('#upgrade-choices button:not([data-upgrade="repair"])').first().click();
      continue;
    }
    const e = s.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
    const keys = e
      ? [
          ...(Math.abs(e.x - s.player.x) > 0.12 ? [e.x > s.player.x ? "KeyD" : "KeyA"] : []),
          ...(Math.abs(e.z - s.player.z) > 0.12 ? [e.z > s.player.z ? "KeyS" : "KeyW"] : []),
        ]
      : [];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(70);
    for (const k of keys) await page.keyboard.up(k);
  }
  throw new Error("The run did not end");
}
async function startRun(page) {
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "playing");
}
/** Clicks at an element's center with the raw mouse, as a player would on an inert dialog. */
async function rawClick(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
/** The revive offer's copy, focus and fit at every viewport, with screenshots. */
async function checkReviveOffer(page, language, checks) {
  await page.locator("#revive-offer").waitFor({ state: "visible" });
  assert.equal(await visible(page, "#result"), false, "the result waits for the decision");
  assert.equal(await page.locator("#revive-offer-title").innerText(), copy[language].title);
  assert.equal(await page.locator("#revive-offer-copy").innerText(), copy[language].body);
  assert.equal((await page.locator("#revive-watch").innerText()).trim(), copy[language].watch);
  assert.equal((await page.locator("#revive-decline").innerText()).trim(), copy[language].decline);
  assert.equal(await activeId(page), "revive-watch", "WATCH AD is focused");
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const tag = `${language}-${width}x${height}`;
    assert.deepEqual(await layoutIssues(page, "#revive-offer .modal-card"), [], `${tag} revive offer`);
    await page.screenshot({ path: path.join(out, `revive-offer-${tag}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  checks.push(`revive offer fits 5 viewports (${language})`);
}
/** The result with WATCH AD · DOUBLE PARTS at every viewport; ONE MORE SHIFT keeps focus. */
async function checkDoubleOffer(page, language, checks, name = "double-parts") {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    await imagesReady(page);
    const tag = `${language}-${width}x${height}`;
    assert.deepEqual(await layoutIssues(page, "#result .modal-card"), [], `${tag} ${name}`);
    assert.equal(await activeId(page), "again", `${tag} ONE MORE SHIFT keeps focus`);
    await page.screenshot({ path: path.join(out, `${name}-${tag}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  checks.push(`${name} fits 5 viewports (${language})`);
}

/** Accepted revive, a second defeat without an offer, then doubled parts with the game muted. */
async function reviveAccepted() {
  const { page, errors } = await openGame("en");
  const checks = [];
  try {
    await startRun(page);
    const before = await progress(page);
    let s = await playUntilDefeated(page);
    await page.locator("#revive-offer").waitFor({ state: "visible" });
    assert.equal(s.receipt, null);
    assert.deepEqual(await progress(page), before, "nothing is recorded while the offer is open");
    await setAd(page, "hold");
    await page.waitForTimeout(450);
    await page.locator("#revive-watch").click();
    await page.waitForFunction(() => window.__fakeSdk.control.pending);
    const during = await sdk(page);
    assert.equal(during.requests, 1);
    const gameplay = during.calls.filter((c) => c.startsWith("gameplay") || c.startsWith("requestAd"));
    assert.deepEqual(gameplay.slice(-2), ["gameplayStop", "requestAd:rewarded"], "gameplay stopped before the ad");
    s = await snapshot(page);
    assert.equal(s.audio.adMuted, true);
    assert.equal(s.audio.level, 0, "game audio muted while the ad plays");
    assert.equal(s.audio.enabled, true, "the player's sound setting is untouched");
    if (s.audio.state === "running") {
      await page.waitForTimeout(300);
      const gain = (await snapshot(page)).audio.gain;
      assert.ok(gain < 0.02, `the master gain has faded out (${gain})`);
      checks.push(`live master gain during the ad: ${gain}`);
    } else checks.push(`audio context ${s.audio.state}: checked the target level only`);
    // The offer ignores clicks and keys until the ad settles.
    await rawClick(page, "#revive-decline");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    assert.equal(await visible(page, "#revive-offer"), true);
    assert.equal(await visible(page, "#result"), false);
    assert.equal((await snapshot(page)).phase, "lost");
    assert.deepEqual(await progress(page), before);
    checks.push("during the ad: paused, muted, offer ignores clicks, Esc and Enter");
    await page.evaluate(() => window.__fakeSdk.finish());
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === "playing");
    s = await snapshot(page);
    assert.equal(s.hp, 50, "revived with 50 health");
    assert.equal(s.receipt, null);
    assert.equal(s.audio.adMuted, false);
    assert.equal(s.audio.level, 0.75, "audio back after the ad");
    if (s.audio.state === "running") {
      await page.waitForTimeout(300);
      const gain = (await snapshot(page)).audio.gain;
      assert.ok(gain > 0.7, `the master gain is back (${gain})`);
    }
    assert.equal(await visible(page, "#revive-offer"), false);
    assert.equal(await activeId(page), "yard");
    assert.deepEqual(await progress(page), before, "a revived run records nothing yet");
    await page.waitForTimeout(1200);
    assert.equal((await sdk(page)).calls.at(-1), "gameplayStart", "gameplay resumes");
    checks.push("rewarded: the run continues with 50 HP and nothing recorded");

    s = await playUntilDefeated(page);
    await page.locator("#result").waitFor({ state: "visible" });
    assert.equal(await visible(page, "#revive-offer"), false, "no second offer");
    s = await snapshot(page);
    const after = await progress(page);
    assert.equal(after.completedRuns, before.completedRuns + 1, "recorded once");
    assert.ok(after.recentRunIds.includes(s.receipt.runId));
    assert.equal(after.parts, s.receipt.parts);
    assert.ok(s.receipt.earned > 0);
    assert.equal(await activeId(page), "again");
    checks.push(`second defeat: straight to results, recorded once, +${s.receipt.earned} parts`);

    // Double parts, muted while its ad plays; the result ignores input meanwhile.
    assert.equal((await page.locator("#double-parts").innerText()).trim(), copy.en.double);
    await setAd(page, "hold");
    await page.locator("#double-parts").click();
    await page.waitForFunction(() => window.__fakeSdk.control.pending);
    assert.equal((await snapshot(page)).audio.level, 0, "muted during the double-parts ad");
    await rawClick(page, "#again");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    assert.equal(await visible(page, "#result"), true, "ONE MORE SHIFT ignored during the ad");
    assert.equal((await snapshot(page)).phase, "lost");
    await page.evaluate(() => window.__fakeSdk.finish());
    await page.locator("#double-parts").waitFor({ state: "detached" });
    const doubled = await progress(page);
    assert.equal(doubled.parts, s.receipt.parts + s.receipt.earned, "bank gains the earned parts again");
    assert.deepEqual(doubled.bonusRunIds, [s.receipt.runId]);
    assert.equal(doubled.completedRuns, after.completedRuns);
    assert.equal(
      await page.locator("#result-reward").innerText(),
      `+${s.receipt.earned * 2} parts (doubled) · Bank: ${doubled.parts}`,
    );
    assert.equal((await snapshot(page)).audio.level, 0.75);
    assert.equal(await activeId(page), "again");
    await page.screenshot({ path: path.join(out, "double-parts-granted-en-1440x900.png") });
    // A language change redraws the result without the offer or another recording.
    await page.locator("#language").click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator("#double-parts").count(), 0);
    assert.equal(await visible(page, "#revive-offer"), false);
    assert.deepEqual(await progress(page), doubled);
    assert.equal((await sdk(page)).requests, 2);
    checks.push(`double parts granted once: bank ${s.receipt.parts} → ${doubled.parts}, hidden after re-render`);
    assert.deepEqual(errors, []);
    return { flow: "revive accepted, double parts", pass: true, checks };
  } finally {
    await page.close();
  }
}

/** Declined offer (NO THANKS in English, Esc in German) and both offers at every viewport. */
async function declinedWithLayouts(language) {
  const { page, errors } = await openGame(language);
  const checks = [];
  try {
    await startRun(page);
    const before = await progress(page);
    await playUntilDefeated(page);
    await checkReviveOffer(page, language, checks);
    await page.waitForTimeout(100);
    if (language === "en") await page.locator("#revive-decline").click();
    else await page.keyboard.press("Escape");
    await page.locator("#result").waitFor({ state: "visible" });
    const s = await snapshot(page);
    const after = await progress(page);
    assert.equal(await visible(page, "#revive-offer"), false);
    assert.equal(after.completedRuns, before.completedRuns + 1, "recorded once");
    assert.equal(after.parts, s.receipt.parts);
    assert.equal((await sdk(page)).requests, 0, "declining plays no ad");
    assert.equal(await activeId(page), "again");
    checks.push(`${language === "en" ? "NO THANKS" : "Esc"}: normal result, recorded once`);
    assert.equal((await page.locator("#double-parts").innerText()).trim(), copy[language].double);
    await checkDoubleOffer(page, language, checks);
    if (language === "en") {
      // An ad error hides the button with a short note, and nothing is banked.
      await setAd(page, "error", "unfilled");
      await page.locator("#double-parts").click();
      await page.locator(".result-double-note").waitFor({ state: "visible" });
      assert.equal(await page.locator("#double-parts").count(), 0);
      assert.equal(await page.locator(".result-double-note").innerText(), copy.en.none);
      assert.deepEqual(await progress(page), after);
      assert.equal(await activeId(page), "again");
      await checkDoubleOffer(page, language, checks, "double-parts-failed");
      checks.push("ad error: button hidden, note shown, bank unchanged");
    } else {
      await setAd(page, "finish");
      await page.locator("#double-parts").click();
      await page.locator("#double-parts").waitFor({ state: "detached" });
      const doubled = await progress(page);
      assert.equal(doubled.parts, after.parts + s.receipt.earned);
      assert.match(await page.locator("#result-reward").innerText(), new RegExp(copy.de.doubled.replace(/[()]/g, "\\$&")));
      await checkDoubleOffer(page, language, checks, "double-parts-granted");
      checks.push(`double parts granted in German: bank ${after.parts} → ${doubled.parts}`);
    }
    assert.deepEqual(errors, []);
    return { flow: `${language} declined, layouts`, pass: true, checks };
  } finally {
    await page.close();
  }
}

/** A failed revive ad goes on to results; Basic Launch then rules out the double-parts offer. */
async function reviveFailed() {
  const { page, errors } = await openGame("en");
  const checks = [];
  try {
    await startRun(page);
    const before = await progress(page);
    await playUntilDefeated(page);
    await page.locator("#revive-offer").waitFor({ state: "visible" });
    await setAd(page, "error", "adsDisabledBasicLaunch");
    await page.waitForTimeout(450);
    await page.locator("#revive-watch").click();
    await page.locator("#result").waitFor({ state: "visible" });
    const s = await snapshot(page);
    assert.equal(s.phase, "lost");
    assert.equal((await progress(page)).completedRuns, before.completedRuns + 1, "recorded once");
    assert.equal(await visible(page, "#revive-offer"), false);
    assert.equal(await page.locator("#double-parts").count(), 0, "no ads for the rest of the session");
    assert.equal(s.audio.adMuted, false);
    assert.equal(await activeId(page), "again");
    checks.push("failed revive ad: normal result, recorded once, no double-parts offer");
    assert.deepEqual(errors, []);
    return { flow: "revive failed", pass: true, checks };
  } finally {
    await page.close();
  }
}

/** A build without VITE_CRAZYGAMES_ADS: the defeat goes straight to the usual result. */
async function adsDisabled() {
  const { page, errors } = await openGame("en");
  try {
    await startRun(page);
    const before = await progress(page);
    await playUntilDefeated(page);
    await page.locator("#result").waitFor({ state: "visible" });
    assert.equal(await visible(page, "#revive-offer"), false);
    assert.equal(await page.locator("#double-parts, .result-double-note").count(), 0);
    assert.equal((await progress(page)).completedRuns, before.completedRuns + 1);
    assert.equal(await activeId(page), "again", "ONE MORE SHIFT keeps focus");
    assert.equal((await sdk(page)).requests, 0);
    assert.match(await page.locator("#result-reward").innerText(), /^\+\d+ parts · Bank: \d+$/);
    await page.screenshot({ path: path.join(out, "ads-off-result-en-1440x900.png") });
    assert.deepEqual(errors, []);
    return { flow: "ads off", pass: true, checks: ["no offers; defeat goes straight to results with focus on ONE MORE SHIFT"] };
  } finally {
    await page.close();
  }
}

const run = async (label, flow) => {
  const started = Date.now();
  try {
    const report = await flow();
    reports.push(report);
    console.log(`PASS ${label} (${Math.round((Date.now() - started) / 1000)} s)`);
    for (const check of report.checks) console.log(`  - ${check}`);
  } catch (error) {
    reports.push({ label, pass: false, failure: String(error.message ?? error) });
    console.log("FAIL", label, String(error.message ?? error));
  }
};
try {
  if (adsOff) await run("ads off", adsDisabled);
  else {
    await run("revive accepted", reviveAccepted);
    await run("en declined and layouts", () => declinedWithLayouts("en"));
    await run("de declined and layouts", () => declinedWithLayouts("de"));
    await run("revive failed", reviveFailed);
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "ads-browser.json"), JSON.stringify(reports, null, 2));
  console.log("Screenshots and report:", out);
}
assert.equal(reports.filter((r) => !r.pass).length, 0, "See ads-browser.json for failed cases");
