import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Isolated renderer fixture: real YardScene/assets, controlled simulation events.
// This verifies visual feedback; it does not claim a naturally played damage event.
const origin = process.env.BASE_URL ?? "http://127.0.0.1:5184";
const output = process.env.PERF_OUTPUT ?? ".impeccable/review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 800, height: 600 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route(`${origin}/`, (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0"><div id="scene" style="width:100vw;height:100vh"></div></body></html>',
  }),
);
await page.goto(`${origin}/`);
await page.evaluate(async () => {
  const { YardScene } = await import("/src/scene.ts");
  const { createState } = await import("/src/simulation.ts");
  window.fixtureScene = new YardScene(document.querySelector("#scene"));
  await window.fixtureScene.load(() => {});
  window.fixtureState = createState();
  window.fixtureState.phase = "playing";
  window.fixtureScene.render(window.fixtureState, 0);
  window.fixtureColors = [];
  window.fixtureScene.robot.traverse((object) => {
    if (object.isMesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material.color) window.fixtureColors.push(material.color.getHex());
      }
  });
  window.fixtureEnemyColors = window.fixtureScene.enemyBatches.map((batch) =>
    batch.material.color.getHex(),
  );
});
const profiles = await page.evaluate(() => {
  return ["performance", "balanced", "high", "ultra"].map((quality) => {
    const scene = window.fixtureScene;
    scene.setQuality(quality);
    scene.render(window.fixtureState, 0);
    return {
      ...scene.diagnostics().graphics,
      composerPixelRatio: scene.composer
        ? scene.composer.renderTarget1.width / scene.host.clientWidth
        : undefined,
      composerWidth: scene.composer?.renderTarget1.width,
    };
  });
});
assert.deepEqual(
  profiles.map((profile) => profile.pixelRatio),
  [1, 1.5, 2, 3],
);
for (const profile of profiles) {
  assert.equal(profile.width, 800 * profile.pixelRatio);
  assert.equal(profile.height, 600 * profile.pixelRatio);
  if (profile.postProcessing) {
    assert.equal(profile.composerPixelRatio, profile.pixelRatio);
    assert.equal(profile.composerWidth, profile.width);
  } else {
    assert.equal(profile.composerPixelRatio, undefined);
    assert.equal(profile.composerWidth, undefined);
  }
}
await page.evaluate(() => {
  window.fixtureScene.setQuality("high");
  window.fixtureScene.render(window.fixtureState, 0);
});
await page.screenshot({ path: `${output}/robot-hurt-before.png` });
const hurt = await page.evaluate(() => {
  const scene = window.fixtureScene,
    state = window.fixtureState;
  scene.events([{ kind: "hurt", ...state.player }], state);
  state.time += 0.1;
  scene.render(state, 0.1);
  const colors = [];
  scene.robot.traverse((object) => {
    if (object.isMesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material.color) colors.push(material.color.getHex());
      }
  });
  return {
    ...scene.diagnostics().robotHurt,
    robotChanged: colors.some(
      (color, index) => color !== window.fixtureColors[index],
    ),
    enemyUnchanged: scene.enemyBatches.every(
      (batch, index) =>
        batch.material.color.getHex() === window.fixtureEnemyColors[index],
    ),
  };
});
assert.ok(hurt.strength > 0.8);
assert.ok(hurt.recoil > 0);
assert.equal(hurt.robotChanged, true);
assert.equal(hurt.enemyUnchanged, true);
await page.screenshot({ path: `${output}/robot-hurt-impact.png` });
const paused = await page.evaluate(() => {
  const scene = window.fixtureScene,
    state = window.fixtureState;
  state.phase = "paused";
  scene.render(state, 0);
  const before = scene.diagnostics().robotHurt;
  scene.render(state, 0);
  return { before, after: scene.diagnostics().robotHurt };
});
assert.deepEqual(paused.before, paused.after);
await page.emulateMedia({ reducedMotion: "reduce" });
await page.waitForFunction(() => window.fixtureScene.reduced);
const reduced = await page.evaluate(() => {
  const scene = window.fixtureScene,
    state = window.fixtureState;
  scene.events([{ kind: "hurt", ...state.player }], state);
  state.time += 0.1;
  scene.render(state, 0.1);
  return scene.diagnostics().robotHurt;
});
assert.ok(reduced.strength > 0.8);
assert.equal(reduced.recoil, 0);
const reset = await page.evaluate(() => {
  const scene = window.fixtureScene;
  scene.clear();
  const colors = [];
  scene.robot.traverse((object) => {
    if (object.isMesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material.color) colors.push(material.color.getHex());
      }
  });
  return {
    ...scene.diagnostics().robotHurt,
    colorsRestored: colors.every(
      (color, index) => color === window.fixtureColors[index],
    ),
  };
});
assert.deepEqual(reset, { strength: 0, recoil: 0, colorsRestored: true });
assert.deepEqual(errors, []);
const result = {
  fixture: "Controlled renderer events, not natural gameplay",
  profiles,
  hurt,
  paused,
  reduced,
  reset,
  errors,
};
await writeFile(
  `${output}/render-feedback.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
await browser.close();
