import test from "node:test";
import assert from "node:assert/strict";
import { CoopSession, coopConfig } from "./coop-session";
import { DEFAULT_RUN_CONFIG } from "./progression";
const zero = { x: 0, z: 0 };
const session = () =>
  new CoopSession([DEFAULT_RUN_CONFIG, DEFAULT_RUN_CONFIG], "test");
const quiet = (s: CoopSession) => {
  s.players[0].enemies = [];
  s.players[0].spawnTimer = 999;
  s.players[0].pickups = [];
  for (const p of s.players) {
    p.openingRemaining = 0;
  }
};
test("co-op actors move independently, world clock advances once, enemies choose nearest robot", () => {
  const s = session();
  quiet(s);
  s.players[0].player = { x: -8, z: 0 };
  s.players[1].player = { x: 8, z: 0 };
  s.players[0].enemies = [
    { id: 900, x: 10, z: 0, hp: 100, hit: 0, seed: 0, type: "can" },
  ];
  s.tick(0.05, [
    { x: -1, z: 0 },
    { x: 0, z: 1 },
  ]);
  assert.equal(s.players[0].time, 0.05);
  assert.equal(s.players[1].time, 0.05);
  assert.ok(s.players[0].player.x < -8);
  assert.ok(s.players[1].player.z > 0);
  assert.ok(s.players[0].enemies[0].x < 10 && s.players[0].enemies[0].x > 9.9);
  assert.equal(s.players[0].enemies, s.players[1].enemies);
});
test("shared XP is awarded once to each player and upgrades never pause the world", () => {
  const s = session();
  quiet(s);
  s.players[0].pickups = [
    { id: 901, ...s.players[0].player, kind: "xp", value: 5, born: -1 },
  ];
  s.tick(0.05, [zero, zero]);
  for (const p of s.players) {
    assert.equal(p.level, 2);
    assert.equal(p.xp, 0);
    assert.equal(p.choices.length, 3);
    assert.equal(p.phase, "playing");
  }
  const original = s.players[0].player.x;
  for (let i = 0; i < 10; i++) s.tick(0.05, [{ x: -1, z: 0 }, zero]);
  assert.ok(s.players[0].player.x < original);
  assert.ok(s.players[0].time > 0.5);
  const choice = s.players[0].choices[0];
  assert.equal(s.choose(0, choice, 2), true);
  assert.equal(s.players[0].choices.length, 0);
  assert.equal(s.players[1].choices.length, 3);
  assert.equal(s.choose(0, choice, 2), false);
});
test("XP collected while choosing queues further upgrades without dropping earned XP", () => {
  const s = session();
  quiet(s);
  s.players[0].pickups = [
    { id: 901, ...s.players[0].player, kind: "xp", value: 30, born: -1 },
  ];
  s.tick(0.05, [zero, zero]);
  assert.equal(s.players[0].xp, 25);
  s.choose(0, s.players[0].choices[0], 2);
  assert.equal(s.players[0].level, 3);
  assert.equal(s.players[0].xp, 16);
  assert.equal(s.players[1].level, 2);
  assert.equal(s.players[1].xp, 25);
  assert.equal(s.choose(0, s.players[0].choices[0], 2), false);
});
test("a shared chest opens once at normal speed and shared parts are not duplicated", () => {
  const s = session();
  quiet(s);
  for (const p of s.players) p.player = { x: 4, z: 0 };
  for (let i = 0; i < 12; i++) s.tick(0.05, [zero, zero]);
  assert.equal(s.players[0].discovery.chestsOpened, 0);
  for (let i = 0; i < 13; i++) s.tick(0.05, [zero, zero]);
  assert.equal(s.players[0].discovery.chestsOpened, 1);
  assert.equal(s.players[0].earnedParts, 3);
  assert.equal(s.players[1].earnedParts, 3);
  assert.equal(s.players[0].level, 2);
  assert.equal(s.players[1].level, 2);
});
test("separate discoveries both retain progress across different chunks", () => {
  const s = session();
  quiet(s);
  s.players[0].player = { x: 4, z: 0 };
  s.players[1].player = { x: 50, z: 0 };
  for (let i = 0; i < 30; i++) s.tick(0.05, [zero, zero]);
  assert.equal(s.players[0].discovery.chestsOpened, 1);
  assert.ok(s.players[0].discovery.points.some((p) => p.x > 30));
  assert.ok(s.players[0].discovery.points.length <= 22);
});
test("a downed robot is revived after three seconds nearby; team defeat ends the run", () => {
  const s = session();
  quiet(s);
  s.players[1].hp = 0;
  for (let i = 0; i < 59; i++) s.tick(0.05, [zero, zero]);
  assert.equal(s.players[1].hp, 0);
  assert.equal(s.finished, false);
  s.tick(0.05, [zero, zero]);
  s.tick(0.05, [zero, zero]);
  assert.equal(s.players[1].hp, 40);
  assert.ok(s.players[1].immunity > 1.8);
  s.players[0].hp = 0;
  s.players[1].hp = 0;
  s.tick(0.05, [zero, zero]);
  assert.equal(s.finished, true);
  assert.equal(s.snapshot(0).state.phase, "lost");
  assert.equal(s.snapshot(1).state.phase, "lost");
});
test("hazards hit either player; telemetry and remote hurt do not tint the wrong robot", () => {
  const s = session();
  quiet(s);
  s.players[1].player = { x: 7, z: 0 };
  s.players[0].encounters.zones = [
    { x: 7, z: 0, radius: 1, life: 2, damage: 10 },
  ];
  s.tick(0.05, [zero, zero]);
  assert.equal(s.players[0].hp, 100);
  assert.equal(s.players[1].hp, 90);
  assert.equal(
    s.snapshot(0).events.some((e) => e.kind === "hurt"),
    false,
  );
  assert.equal(
    s.snapshot(1).events.some((e) => e.kind === "hurt"),
    true,
  );
});
test("forged movement and workshop config cannot raise authoritative combat stats", () => {
  const c = coopConfig({
    robotId: "scout",
    damageMultiplier: 999,
    speedMultiplier: 999,
    pickupBonus: Infinity,
    damageReduction: 999,
  });
  assert.equal(c.speedMultiplier, 1.18);
  assert.equal(c.damageMultiplier, 1);
  assert.equal(c.damageReduction, 3);
  assert.equal(c.pickupBonus, 0.8);
});

test("long co-op battle stays live with pending choices, unique entities and bounded pools", () => {
  const s = session();
  for (const p of s.players) {
    p.immunity = 1000;
    p.upgrades = {
      ...p.upgrades,
      saw: 5,
      lightning: 5,
      turret: 5,
      burst: 5,
      magnet: 4,
    };
    p.xp = 5;
  }
  let sawBoss = false;
  for (let tick = 0; tick < 5700; tick++) {
    const angle = tick / 240;
    s.tick(1 / 30, [
      { x: Math.cos(angle), z: Math.sin(angle) },
      { x: Math.cos(angle + 0.3), z: Math.sin(angle + 0.3) },
    ]);
    sawBoss ||= !!s.players[0].encounters.active;
    const p = s.players[0];
    assert.equal(s.finished, false);
    assert.equal(p.phase, "playing");
    assert.ok(p.enemies.length <= 140 && p.pickups.length <= 320);
    assert.ok(
      p.encounters.warnings.length <= 32 &&
        p.encounters.projectiles.length <= 64 &&
        p.encounters.zones.length <= 12,
    );
    assert.ok(
      p.discovery.points.length <= 22 && p.discovery.consumed.size <= 256,
    );
    const ids = [
      ...p.enemies,
      ...p.pickups,
      ...s.players.flatMap((a) => [...a.shots, ...a.turrets]),
    ].map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(s.players[0].earnedParts, s.players[1].earnedParts);
    assert.equal(s.players[0].xp, s.players[1].xp);
    if (tick % 2 === 0) s.clearEvents();
  }
  assert.ok(s.players[0].time > 189);
  assert.ok(sawBoss);
  assert.equal(s.players[0].choices.length, 3);
  assert.equal(s.players[1].choices.length, 3);
  assert.ok(s.players.every((p) => p.launched > 0));
});

test("spawn pressure alternates between separated living players", () => {
  const s = session();
  quiet(s);
  s.players[0].player = { x: -80, z: 0 };
  s.players[1].player = { x: 80, z: 0 };
  s.players[0].spawnTimer = 0;
  s.tick(0.033, [zero, zero]);
  assert.equal(s.players[0].enemies.length, 1);
  assert.ok(s.players[0].enemies[0].x > 45);
  s.players[0].spawnTimer = 0;
  s.tick(0.033, [zero, zero]);
  assert.equal(s.players[0].enemies.length, 2);
  assert.ok(s.players[0].enemies[1].x < -45);
});
