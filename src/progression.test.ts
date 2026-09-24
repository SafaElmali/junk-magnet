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
  assert.deepEqual(p.upgrades, {
    hull: 3,
    magnet: 1,
    rerolls: 0,
    banishes: 0,
    revive: 0,
    xp: 0,
    scrap: 0,
    salvage: 0,
  });
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
    runId: "run-1",
    earned: 12,
    multiplier: 1,
    parts: 12,
    bestTime: 95,
    bestKills: 29,
    orders: [],
    daily: null,
    unlockedStage: null,
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
    upgrades: { hull: 3, magnet: 3, rerolls: 3, banishes: 2, revive: 1, xp: 3, scrap: 2, salvage: 3 },
    unlockedRobots: ["scrap", "scout", "volt"],
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
  assert.equal(
    canAffordWorkshop({ ...maxed, upgrades: { ...maxed.upgrades, revive: 0 }, parts: 399 }),
    false,
  );
  assert.equal(
    canAffordWorkshop({ ...maxed, upgrades: { ...maxed.upgrades, revive: 0 }, parts: 400 }),
    true,
    "Backup Battery costs 400 parts",
  );
});

test("a save from before work orders loads unchanged and gains neutral defaults", () => {
  const old = {
    version: 1,
    parts: 212,
    selectedRobot: "scout",
    unlockedRobots: ["scrap", "scout"],
    upgrades: { hull: 2, magnet: 1 },
    bestTime: 431,
    bestKills: 612,
    completedRuns: 17,
    recentRunIds: ["a", "b"],
  };
  const saved = storage(old);
  const p = loadProgress(saved);
  for (const [key, value] of Object.entries(old))
    if (key !== "upgrades")
      assert.deepEqual(p[key as keyof typeof p], value, key);
  assert.equal(p.upgrades.hull, 2);
  assert.equal(p.upgrades.magnet, 1);
  assert.equal(p.upgrades.salvage, 0);
  assert.equal(p.stage, "yard");
  assert.deepEqual(p.clearedStages, []);
  assert.deepEqual(p.orders, []);
  assert.equal(p.stats.kills, 0);
  assert.deepEqual(p.daily, { date: "", best: 0, streak: 0, longest: 0, days: 0 });
  const config = createProgression(saved).getRunConfig();
  assert.equal(config.rerolls, 1);
  assert.equal(config.banishes, 1);
  assert.equal(config.revives, 0);
  assert.equal(config.xpMultiplier, 1);
  assert.equal(config.partsMultiplier, 1);
  assert.equal(config.startingScrap, 0);
  assert.equal(config.stage, "yard");
  assert.equal(config.daily, null);
});

test("new saved fields validate like the old ones", () => {
  const p = loadProgress(
    storage({
      version: 1,
      upgrades: { rerolls: 9, banishes: -1, revive: 1.7, xp: "x", scrap: 2, salvage: 3 },
      stage: "night",
      clearedStages: ["night", "moon", "night"],
      stats: { kills: 2e9, bosses: -4, bestLevel: 31.9 },
      evolutions: ["storm", "laser", "storm"],
      robotsUsed: ["volt", "magna"],
      orders: ["survive-2", "nope", "survive-2", "boss"],
      ordersSeen: 99,
      daily: { date: "2026-02-31", streak: 4 },
      bonusRunIds: [3, "r"],
    }),
  );
  assert.deepEqual(p.upgrades, {
    hull: 0,
    magnet: 0,
    rerolls: 3,
    banishes: 0,
    revive: 1,
    xp: 0,
    scrap: 2,
    salvage: 3,
  });
  assert.equal(p.stage, "yard", "Night Shift needs a Scrapyard clear");
  assert.deepEqual(p.clearedStages, ["night"]);
  assert.equal(p.stats.kills, 1_000_000_000);
  assert.equal(p.stats.bosses, 0);
  assert.equal(p.stats.bestLevel, 31);
  assert.deepEqual(p.evolutions, ["storm"]);
  assert.deepEqual(p.robotsUsed, ["volt"]);
  assert.deepEqual(p.orders, ["survive-2", "boss"]);
  assert.equal(p.ordersSeen, 2);
  assert.equal(p.daily.date, "");
  assert.equal(p.daily.streak, 0);
  assert.deepEqual(p.bonusRunIds, ["r"]);
  const cleared = loadProgress(
    storage({ version: 1, stage: "night", clearedStages: ["yard"] }),
  );
  assert.equal(cleared.stage, "night");
});

test("workshop upgrades set run config values, with rising prices and capped ranks", () => {
  const a = createProgression(storage());
  a.recordRun({ runId: "bank", phase: "lost", time: 0, kills: 0, earnedParts: 5000 });
  const spend = (id: Parameters<typeof a.buyUpgrade>[0]) => {
    const before = a.getProgress().parts;
    assert.equal(a.buyUpgrade(id), true, id);
    return before - a.getProgress().parts;
  };
  assert.deepEqual([spend("rerolls"), spend("rerolls"), spend("rerolls")], [50, 120, 220]);
  assert.deepEqual([spend("banishes"), spend("banishes")], [80, 180]);
  assert.equal(spend("revive"), 400);
  assert.deepEqual([spend("xp"), spend("xp"), spend("xp")], [70, 160, 280]);
  assert.deepEqual([spend("scrap"), spend("scrap")], [40, 100]);
  assert.deepEqual([spend("salvage"), spend("salvage"), spend("salvage")], [90, 200, 360]);
  for (const id of ["rerolls", "banishes", "revive", "xp", "scrap", "salvage"] as const)
    assert.equal(a.buyUpgrade(id), false, `${id} is capped`);
  assert.equal(a.buyUpgrade("bogus" as never), false);
  const c = a.getRunConfig();
  assert.equal(c.rerolls, 4);
  assert.equal(c.banishes, 3);
  assert.equal(c.revives, 1);
  assert.equal(c.xpMultiplier, 1.15);
  assert.equal(c.startingScrap, 8);
  assert.equal(c.partsMultiplier, 1.3);
  assert.equal(
    canAffordWorkshop({ ...a.getProgress(), parts: 5000 }),
    true,
    "hull and magnet remain",
  );
});

test("stage bonus and Salvage License multiply banked run parts, not order or daily rewards", () => {
  const a = createProgression(storage());
  const base = { phase: "lost", time: 300, kills: 400, earnedParts: 55 };
  // 55 + 40 for kills + 10 for time = 105 parts before multipliers.
  assert.equal(a.recordRun({ ...base, runId: "yard" })?.earned, 105);
  assert.equal(
    a.recordRun({ ...base, runId: "license", partsMultiplier: 1.3 })?.earned,
    136,
  );
  const night = a.recordRun({
    ...base,
    runId: "night",
    stage: "night",
    partsMultiplier: 1.3,
  })!;
  assert.equal(night.multiplier, 1.95);
  assert.equal(night.earned, 204);
  assert.equal(
    a.recordRun({ ...base, runId: "odd", partsMultiplier: Number.NaN })?.earned,
    105,
  );
  assert.equal(
    a.recordRun({ ...base, runId: "huge", partsMultiplier: 50 })?.earned,
    315,
  );
  const daily = a.recordRun({
    ...base,
    runId: "daily",
    daily: "2026-09-24",
    partsMultiplier: 1.3,
  })!;
  assert.equal(daily.earned, 136);
  assert.equal(daily.daily?.reward, 25);
  assert.equal(daily.parts, a.getProgress().parts);
});

test("Night Shift unlocks after a Scrapyard clear and the choice is saved", () => {
  const saved = storage(),
    a = createProgression(saved);
  const clear = { phase: "won", stage: "yard" as const, time: 900, kills: 0, earnedParts: 0 };
  assert.equal(a.selectStage("night"), false);
  assert.equal(a.getRunConfig().stage, "yard");
  assert.equal(
    a.recordRun({ ...clear, runId: "loss", phase: "lost" })?.unlockedStage,
    null,
  );
  assert.equal(a.recordRun({ ...clear, runId: "clear" })?.unlockedStage, "night");
  assert.equal(a.recordRun({ ...clear, runId: "again" })?.unlockedStage, null);
  assert.equal(a.getProgress().stats.clears, 2);
  assert.equal(a.selectStage("night"), true);
  assert.equal(a.selectStage("moon" as never), false);
  assert.equal(createProgression(saved).getRunConfig().stage, "night");
  assert.equal(a.selectStage("yard"), true);
  assert.equal(a.getRunConfig().stage, "yard");
});

test("a recorded run can receive one bonus, once", () => {
  const a = createProgression(storage());
  const receipt = a.recordRun({
    runId: "ad",
    phase: "lost",
    time: 60,
    kills: 50,
    earnedParts: 10,
  })!;
  assert.equal(receipt.earned, 17);
  assert.equal(a.grantBonusParts("missing", receipt.earned), 0);
  assert.equal(a.grantBonusParts("ad", 0), 0);
  assert.equal(a.grantBonusParts("ad", receipt.earned), 17);
  assert.equal(a.getProgress().parts, receipt.parts + 17);
  assert.equal(a.grantBonusParts("ad", receipt.earned), 0);
  assert.deepEqual(a.getProgress().bonusRunIds, ["ad"]);
});
