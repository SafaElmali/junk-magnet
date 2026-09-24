import test from "node:test";
import assert from "node:assert/strict";
import {
  canAffordWorkshop,
  createProgression,
  loadProgress,
} from "./progression";
const storage = (seed?: unknown) => {
  let data = seed === undefined ? null : JSON.stringify(seed);
  return {
    getItem: (_key: string) => data,
    setItem: (_key: string, value: string) => {
      data = value;
    },
  };
};
test("progress validates malformed storage, clamps ranks and refuses locked selections", () => {
  const corrupted = storage({
    version: 1,
    parts: -40,
    selectedRobot: "volt",
    unlockedRobots: ["scout", "bad", "scout"],
    upgrades: { hull: 999, magnet: 1.8 },
    bestTime: "bad",
    recentRunIds: ["a", 7, "a"],
  });
  const p = loadProgress(corrupted);
  assert.equal(p.parts, 0);
  assert.equal(p.selectedRobot, "scrap");
  assert.deepEqual(p.unlockedRobots, ["scrap", "scout"]);
  assert.deepEqual(p.upgrades, { hull: 3, magnet: 1 });
  assert.equal(p.bestTime, 0);
  assert.deepEqual(p.recentRunIds, ["a"]);
  assert.equal(loadProgress(storage({ version: 99, parts: 999 })).parts, 0);
  assert.equal(
    loadProgress({ getItem: () => "broken json", setItem: () => {} }).parts,
    0,
  );
});
test("only completed losses earn rewards and each stored run is rewarded once across reloads", () => {
  const saved = storage(),
    a = createProgression(saved);
  const run = {
    runId: "run-1",
    phase: "lost",
    time: 95,
    kills: 29,
    earnedParts: 7,
  };
  assert.equal(a.recordRun({ ...run, phase: "paused" }), null);
  assert.equal(a.recordRun({ ...run, phase: "ready" }), null);
  assert.deepEqual(a.recordRun(run), {
    earned: 12,
    parts: 12,
    bestTime: 95,
    bestKills: 29,
  });
  assert.equal(a.recordRun(run), null);
  const b = createProgression(saved);
  assert.equal(b.recordRun(run), null);
  assert.equal(b.getProgress().completedRuns, 1);
  assert.equal(
    b.recordRun({ ...run, runId: "run-2", time: 60, kills: 10, earnedParts: 0 })
      ?.earned,
    3,
  );
  assert.equal(b.getProgress().bestTime, 95);
  assert.equal(b.getProgress().bestKills, 29);
});
test("robots require payment and unlocked selection, upgrades debit correct increasing costs", () => {
  const a = createProgression(storage());
  assert.equal(a.selectRobot("volt"), false);
  assert.equal(a.unlockRobot("scout"), false);
  assert.equal(a.buyUpgrade("hull"), false);
  a.recordRun({
    runId: "funds",
    phase: "lost",
    time: 0,
    kills: 0,
    earnedParts: 600,
  });
  assert.equal(a.unlockRobot("scout"), true);
  assert.equal(a.getProgress().parts, 520);
  assert.equal(a.unlockRobot("scout"), false);
  assert.equal(a.selectRobot("scout"), true);
  assert.equal(a.getRunConfig().speedMultiplier, 1.18);
  const snapshot = a.getRunConfig();
  for (const expected of [495, 435, 325]) {
    assert.equal(a.buyUpgrade("hull"), true);
    assert.equal(a.getProgress().parts, expected);
  }
  assert.equal(a.buyUpgrade("hull"), false);
  assert.equal(a.getRunConfig().damageReduction, 3);
  assert.equal(snapshot.damageReduction, 0);
  assert.equal(a.buyUpgrade("magnet"), true);
  assert.ok(Math.abs(a.getRunConfig().pickupBonus - 1.15) < 1e-8);
  assert.equal(a.unlockRobot("volt"), true);
  assert.equal(a.selectRobot("volt"), true);
  assert.equal(a.getRunConfig().startingWeapon, "lightning");
  const detached = a.getProgress();
  detached.parts = 9999;
  assert.notEqual(a.getProgress().parts, 9999);
});
test("blocked storage keeps in-memory progression and bounded receipt history", () => {
  const blocked = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  };
  const a = createProgression(blocked);
  for (let i = 0; i < 100; i++)
    a.recordRun({
      runId: `run-${i}`,
      phase: "lost",
      time: 30,
      kills: 10,
      earnedParts: 1,
    });
  const p = a.getProgress();
  assert.equal(p.parts, 300);
  assert.equal(p.completedRuns, 100);
  assert.equal(p.recentRunIds.length, 64);
  assert.equal(
    a.recordRun({
      runId: "run-99",
      phase: "lost",
      time: 30,
      kills: 10,
      earnedParts: 1,
    }),
    null,
  );
  assert.equal(a.unlockRobot("scout"), true);
});

test("workshop affordability covers locked robots and the next upgrade rank only", () => {
  const base = loadProgress(storage());
  const maxed: typeof base = {
    ...base,
    upgrades: { hull: 3, magnet: 3 },
    unlockedRobots: ["scrap", "scout", "volt", "magna"],
  };
  assert.equal(canAffordWorkshop(base), false);
  assert.equal(canAffordWorkshop({ ...base, parts: 24 }), false);
  assert.equal(canAffordWorkshop({ ...base, parts: 25 }), true);
  assert.equal(canAffordWorkshop({ ...maxed, parts: 999 }), false);
  assert.equal(
    canAffordWorkshop({ ...maxed, unlockedRobots: ["scrap"], parts: 80 }),
    true,
    "Scout costs 80 parts",
  );
});
