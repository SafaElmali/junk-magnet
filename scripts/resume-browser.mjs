// Real play, real reloads and the real Continue button: an unfinished solo run
// survives a reload, including one saved during a level-up choice. No state is
// injected; the layout pass reuses a snapshot this script produced by playing.
// Set ANALYTICS=1 against a server started with VITE_ANALYTICS_DEV=true and a
// dummy VITE_POSTHOG_KEY to also check run_resumed (PostHog is intercepted).
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5184/play/";
const shots =
  process.env.SHOT_DIR ??
  (await fs.mkdtemp(path.join(os.tmpdir(), "junk-magnet-resume-")));
const KEY = "junkmagnet-run-v1";
const analytics = process.env.ANALYTICS === "1";
const read = (page) => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
const saved = (page) => page.evaluate((key) => localStorage.getItem(key), KEY);
// PostHog batches for a few seconds; let it send before a reload drops the page.
const flush = (page) => analytics && page.waitForTimeout(4000);
const ready = (page) =>
  page.waitForFunction(() => window.__JUNK_MAGNET__, null, { timeout: 30000 });
/** Steers toward energy (or circles), taking the first choice at each level-up. */
async function play(page, seconds, { stopAtUpgrade = false } = {}) {
  const end = (await read(page)).time + seconds;
  for (let i = 0; i < 3000; i++) {
    const s = await read(page);
    if (s.phase === "upgrade") {
      if (stopAtUpgrade) return s;
      await page.waitForTimeout(300); // Choices ignore input for 250 ms.
      await page.keyboard.press("Digit1");
      continue;
    }
    if (s.phase !== "playing") throw Error(`unexpected phase ${s.phase}`);
    if (s.time >= end) return s;
    const target = s.xpDrops
      .map((p) => ({ ...p, d: Math.hypot(p.x - s.player.x, p.z - s.player.z) }))
      .sort((a, b) => a.d - b.d)[0] ?? {
      x: s.player.x + Math.cos(s.time),
      z: s.player.z + Math.sin(s.time),
    };
    const keys = [
      ...(Math.abs(target.x - s.player.x) > 0.2
        ? [target.x > s.player.x ? "KeyD" : "KeyA"]
        : []),
      ...(Math.abs(target.z - s.player.z) > 0.2
        ? [target.z > s.player.z ? "KeyS" : "KeyW"]
        : []),
    ];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(120);
    for (const k of keys) await page.keyboard.up(k);
  }
  throw Error("play loop did not finish");
}
async function pause(page) {
  for (let i = 0; i < 20; i++) {
    const s = await read(page);
    if (s.phase === "paused") return s;
    if (s.phase === "upgrade") {
      await page.waitForTimeout(300);
      await page.keyboard.press("Digit1");
    } else await page.keyboard.press("Escape");
    await page.waitForTimeout(50);
  }
  throw Error("could not pause");
}
const same = (a, b, message) => {
  for (const key of ["time", "level", "kills", "hp", "xp", "scrap", "launched"])
    assert.equal(b[key], a[key], `${message}: ${key}`);
  assert.deepEqual(b.player, a.player, `${message}: position`);
  assert.deepEqual(b.upgrades, a.upgrades, `${message}: upgrades`);
  assert.deepEqual(b.robot, a.robot, `${message}: run config`);
  assert.equal(b.enemyCount, a.enemyCount, `${message}: enemies`);
};
const report = { url, shots, checks: [], analytics };
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    // PostHog ignores headless Chrome's user agent.
    ...(analytics && {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    }),
  });
  const events = [];
  if (analytics) {
    await context.addInitScript(() =>
      Object.defineProperty(navigator, "webdriver", { get: () => false }),
    );
    await context.route(/https:\/\/[^/]*posthog\.com\//, async (route) => {
      const request = route.request();
      if (request.url().includes("/e/")) {
        let body = request.postDataBuffer();
        if (body?.[0] === 0x1f && body?.[1] === 0x8b) body = gunzipSync(body);
        if (body) {
          const payload = JSON.parse(body.toString());
          events.push(
            ...(Array.isArray(payload) ? payload : (payload.batch ?? [payload])),
          );
        }
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await ready(page);
  assert.equal(await saved(page), null, "fresh browser has no saved run");
  await page.locator("#start").click();

  // 1. About 20 seconds of play, pause (which saves), reload, Continue.
  await play(page, 20);
  const paused = await pause(page);
  const bytes = (await saved(page)).length;
  report.snapshotBytesAt20s = bytes;
  assert.ok(bytes > 1000 && bytes < 300_000, `${bytes} bytes`);
  await flush(page);
  await page.reload();
  await ready(page);
  await page.locator("#start-label").waitFor();
  assert.equal(await page.locator("#start-label").textContent(), "CONTINUE");
  assert.equal(await page.locator("#new-run").isVisible(), true);
  const restored = await read(page);
  assert.equal(restored.phase, "paused");
  same(paused, restored, "restored after reload");
  await page.screenshot({ path: path.join(shots, "resume-menu-1440.png") });
  await page.locator("#start").click();
  await page.waitForFunction(
    (t) => window.__JUNK_MAGNET__.snapshot().time > t + 0.5,
    paused.time,
  );
  const continued = await read(page);
  assert.equal(continued.phase, "playing");
  assert.ok(continued.level >= paused.level && continued.kills >= paused.kills);
  report.checks.push(
    `20 s run restored after reload: ${paused.time.toFixed(2)} s, level ${paused.level}, ${paused.kills} kills, (${paused.player.x.toFixed(2)}, ${paused.player.z.toFixed(2)})`,
  );

  // 2. Closing or reloading mid-play saves on pagehide, not the older autosave.
  await play(page, 3);
  await flush(page);
  const before = await read(page);
  await page.reload();
  await ready(page);
  const afterPagehide = await read(page);
  assert.ok(
    afterPagehide.time >= before.time && afterPagehide.time < before.time + 2,
    `${afterPagehide.time} vs ${before.time}`,
  );
  assert.equal(afterPagehide.level >= before.level, true);
  report.checks.push("reload during play saved on pagehide");

  // 3. A run saved during a level-up returns to that choice.
  await page.locator("#new-run").click();
  assert.ok((await read(page)).time < 1, "new run starts at 0:00");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyD");
  await page.waitForFunction(
    () => window.__JUNK_MAGNET__.snapshot().phase === "upgrade",
  );
  const choosing = await read(page);
  await flush(page);
  await page.reload();
  await ready(page);
  const pending = await read(page);
  assert.equal(pending.phase, "paused");
  assert.deepEqual(pending.choices, choosing.choices);
  same(choosing, pending, "restored level-up");
  await page.locator("#start").click();
  await page.locator("#upgrade").waitFor({ state: "visible" });
  assert.equal((await read(page)).phase, "upgrade");
  assert.deepEqual(
    await page
      .locator("#upgrade-choices [data-upgrade]")
      .evaluateAll((buttons) => buttons.map((b) => b.dataset.upgrade)),
    choosing.choices,
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.choice),
    "0",
    "first choice has focus",
  );
  await page.screenshot({ path: path.join(shots, "resume-level-up-1440.png") });
  const levelUpSnapshot = await saved(page);
  await page.waitForTimeout(300);
  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    () => window.__JUNK_MAGNET__.snapshot().phase === "playing",
  );
  const picked = await read(page);
  assert.equal(
    picked.upgrades[choosing.choices[0]],
    choosing.upgrades[choosing.choices[0]] + 1,
  );
  assert.equal(picked.level, choosing.level);
  report.checks.push(`mid-level-up reload kept choices ${choosing.choices.join(", ")}`);

  // 4. New Run discards the saved run.
  await flush(page);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator("#start-label").textContent(), "CONTINUE");
  await page.locator("#new-run").click();
  assert.equal(await saved(page), null, "new run clears the snapshot");
  assert.ok((await read(page)).time < 1);
  report.checks.push("New Run clears the saved run");

  // 5. A finished run leaves nothing to continue.
  for (let i = 0; i < 1200; i++) {
    const s = await read(page);
    if (s.phase === "lost") break;
    if (s.phase === "upgrade") {
      await page.waitForTimeout(300);
      await page.keyboard.press("Digit1");
      continue;
    }
    if (i === 60) await page.keyboard.press("Escape"); // Save mid-run first.
    if (s.phase === "paused") await page.keyboard.press("Escape");
    const e = s.enemies.sort(
      (a, b) =>
        Math.hypot(a.x - s.player.x, a.z - s.player.z) -
        Math.hypot(b.x - s.player.x, b.z - s.player.z),
    )[0];
    const keys = e
      ? [
          ...(Math.abs(e.x - s.player.x) > 0.12 ? [e.x > s.player.x ? "KeyD" : "KeyA"] : []),
          ...(Math.abs(e.z - s.player.z) > 0.12 ? [e.z > s.player.z ? "KeyS" : "KeyW"] : []),
        ]
      : [];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(65);
    for (const k of keys) await page.keyboard.up(k);
  }
  const lost = await read(page);
  assert.equal(lost.phase, "lost");
  await page.locator("#result").waitFor({ state: "visible" });
  assert.equal(await saved(page), null, "defeat clears the snapshot");
  await flush(page);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator("#start-label").textContent(), "PLAY");
  assert.equal((await read(page)).phase, "ready");
  report.checks.push(`defeat at ${lost.time.toFixed(1)} s clears the saved run`);

  if (analytics) {
    await page.waitForTimeout(4000);
    const of = (name) => events.filter((e) => e.event === name);
    report.events = events.map((e) => e.event);
    // Steps 1 and 3 continue a restored run; 2 and 4 start a new one instead.
    assert.equal(of("run_resumed").length, 2, "one per continued restore");
    const firstRun = of("run_started")[0].properties.run_id;
    assert.equal(of("run_resumed")[0].properties.run_id, firstRun);
    assert.equal(
      of("run_started").filter((e) => e.properties.run_id === firstRun).length,
      1,
      "a resumed run never starts twice",
    );
    // Seconds since the page was left: the reload's pagehide saved last.
    const away = of("run_resumed")[0].properties.away_seconds;
    assert.ok(Number.isInteger(away) && away >= 0 && away < 60, `away_seconds ${away}`);
    assert.equal(of("run_completed").length, 1, "the defeat completes once");
    assert.equal(of("run_resumed")[0].properties.level, paused.level);
    report.checks.push(
      `analytics: ${events.map((e) => e.event).filter((e) => e.startsWith("run_")).join(", ")}`,
    );
  }
  assert.deepEqual(errors, []);
  await context.close();

  // 6. At every layout, in English and German, a restored run shows the same
  // Continue menu as Pause → Main Menu, and its level-up sheet fits.
  const overflow = (page, selector) =>
    page.evaluate(
      (selector) =>
        [...document.querySelectorAll(selector)]
          .filter((e) => e.getClientRects().length)
          .flatMap((e) => {
            const r = e.getBoundingClientRect();
            return e.scrollHeight > e.clientHeight + 2 ||
              e.scrollWidth > e.clientWidth + 2 ||
              r.top < -1 ||
              r.left < -1 ||
              r.bottom > innerHeight + 1 ||
              r.right > innerWidth + 1
              ? [`${e.id || e.className}`]
              : [];
          }),
      selector,
    );
  /** Menu geometry once images load and the entry animation settles. */
  const menuLayout = async (page) => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#intro img")]
        .filter((img) => img.getClientRects().length)
        .every((img) => img.complete && img.naturalWidth > 0),
    );
    let last = "";
    for (let i = 0; i < 40; i++) {
      const next = JSON.stringify(
        await page.evaluate(() =>
          [...document.querySelectorAll(".menu-shell, #menu-home button")]
            .filter((e) => e.getClientRects().length)
            .map((e) => {
              const r = e.getBoundingClientRect();
              return [e.id || e.className, e.textContent.trim(), ...[r.left, r.top, r.width, r.height].map(Math.round)];
            }),
        ),
      );
      if (next === last) return JSON.parse(next);
      last = next;
      await page.waitForTimeout(150);
    }
    throw Error("menu never settled");
  };
  for (const locale of ["en-US", "de-DE"])
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 568],
      [844, 390],
      [568, 320],
    ]) {
      const options = {
        viewport: { width, height },
        locale,
        hasTouch: width < 900,
        isMobile: width < 900,
      };
      const tag = `${locale.slice(0, 2)}-${width}x${height}`;
      const reference = await browser.newContext(options);
      const live = await reference.newPage();
      await live.goto(url);
      await ready(live);
      await live.locator("#start").click();
      await live.waitForTimeout(600);
      await live.locator("#pause").click();
      await live.locator("#pause-menu").click();
      const inMemory = await menuLayout(live);
      await reference.close();

      const layout = await browser.newContext(options);
      await layout.addInitScript(
        ([key, value]) => {
          if (!sessionStorage.getItem("seeded")) {
            localStorage.setItem(key, value);
            sessionStorage.setItem("seeded", "1");
          }
        },
        [KEY, levelUpSnapshot],
      );
      const view = await layout.newPage();
      const viewErrors = [];
      view.on("pageerror", (e) => viewErrors.push(e.message));
      await view.goto(url);
      await ready(view);
      assert.deepEqual(await menuLayout(view), inMemory, `${tag} restored menu`);
      assert.deepEqual(
        await overflow(view, ".menu-shell, #intro button, #intro h3, #intro p"),
        [],
        `${tag} restored menu fits`,
      );
      await view.screenshot({ path: path.join(shots, `resume-menu-${tag}.png`) });
      await view.locator("#start").click();
      await view.locator("#upgrade").waitFor({ state: "visible" });
      await view.waitForFunction(() =>
        [...document.querySelectorAll("#upgrade img")].every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      );
      assert.deepEqual(
        await overflow(view, ".upgrade-sheet, .upgrade-choice"),
        [],
        `${tag} restored level-up`,
      );
      await view.screenshot({ path: path.join(shots, `resume-level-up-${tag}.png`) });
      assert.deepEqual(viewErrors, []);
      await layout.close();
      report.checks.push(`layout ${tag}`);
    }
  report.pass = true;
} finally {
  await browser.close();
  await fs.writeFile(path.join(shots, "resume-browser.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
