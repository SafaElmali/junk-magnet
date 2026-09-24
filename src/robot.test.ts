import test from "node:test";
import assert from "node:assert/strict";
import { createProgression, ROBOTS, type PermanentUpgrade } from "./progression";
import { createState, update } from "./simulation";
import { coopConfig } from "./coop-session";
import { LANGUAGES, setLanguage, t } from "./i18n";

function workshop(parts: number, upgrades: PermanentUpgrade[] = []) {
  const data = new Map<string, string>();
  const w = createProgression({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  });
  w.recordRun({ runId: "funds", phase: "lost", time: 0, kills: 0, earnedParts: parts });
  for (const id of upgrades) assert.equal(w.buyUpgrade(id), true);
  return w;
}
/** A run in the clear spawn area with no drops, spawns or opening pause. */
function yard(robot: "scrap" | "magna") {
  const w = workshop(160);
  if (robot === "magna") assert.ok(w.unlockRobot("magna") && w.selectRobot("magna"));
  const s = createState(w.getRunConfig());
  s.phase = "playing";
  s.openingRemaining = 0;
  s.pickups = [];
  s.enemies = [];
  s.spawnTimer = 100;
  return s;
}

test("MAGNA costs 160 parts and brings its heavy loadout into the run", () => {
  assert.equal(workshop(159).unlockRobot("magna"), false);
  const w = workshop(160);
  assert.equal(w.unlockRobot("magna"), true);
  assert.equal(w.getProgress().parts, 0);
  assert.equal(w.selectRobot("magna"), true);
  const config = w.getRunConfig();
  assert.equal(config.robotId, "magna");
  assert.equal(config.startingWeapon, "burst");
  assert.equal(config.speedMultiplier, 0.92);
  assert.equal(config.pickupBonus, 0.4);
  assert.equal(config.damageReduction, 2);
  assert.equal(config.damageMultiplier, 1);
  const s = createState(config);
  assert.equal(s.upgrades.burst, 1);
  assert.equal(s.upgrades.saw, 0);
  // Workshop ranks stack on the robot's own armor and reach.
  const tuned = workshop(160 + 25 + 25, ["hull", "magnet"]);
  assert.ok(tuned.unlockRobot("magna") && tuned.selectRobot("magna"));
  assert.equal(tuned.getRunConfig().damageReduction, 3);
  assert.ok(Math.abs(tuned.getRunConfig().pickupBonus - 0.75) < 1e-9);
});

test("MAGNA shrugs off 2 contact damage, moves 8% slower and bursts at once", () => {
  const hit = (robot: "scrap" | "magna") => {
    const s = yard(robot);
    s.enemies = [{ id: 900, x: 0.2, z: 0, hp: 50, hit: 0, seed: 0, type: "can" }];
    update(s, 0.01, { x: 0, z: 0 });
    return s;
  };
  assert.equal(100 - hit("scrap").hp, 9);
  const heavy = hit("magna");
  assert.equal(100 - heavy.hp, 7);
  assert.ok(heavy.events.some((e) => e.kind === "burst"), "starts with Magnetic Burst");
  const s = yard("magna");
  update(s, 0.05, { x: 1, z: 0 });
  assert.ok(Math.abs(s.player.x - 6.2 * 0.92 * 0.05) < 1e-9);
});

test("co-op keeps MAGNA's own armor on top of the workshop cap", () => {
  const c = coopConfig({ robotId: "magna", damageReduction: 999, pickupBonus: 999 });
  assert.equal(c.startingWeapon, "burst");
  assert.equal(c.speedMultiplier, 0.92);
  assert.equal(c.damageReduction, 5);
  assert.ok(Math.abs(c.pickupBonus - 1.45) < 1e-9);
  assert.equal(coopConfig({ robotId: "magna", damageReduction: 2 }).damageReduction, 2);
  assert.equal(coopConfig({ robotId: "magna" }).damageReduction, 2);
});

test("every robot description is translated into every language", () => {
  for (const { code } of LANGUAGES) {
    setLanguage(code);
    for (const robot of ROBOTS)
      if (code === "en") assert.equal(t(robot.description), robot.description);
      else assert.notEqual(t(robot.description), robot.description, `${code}: ${robot.id}`);
  }
  setLanguage("en");
});
