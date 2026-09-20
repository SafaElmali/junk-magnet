import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  update,
  launch,
  OPENING_DURATION,
  MAX_SCRAP,
  ENTITY_LIMITS,
  orbitPosition,
  chooseUpgrade,
  UPGRADES,
  type Enemy,
  type UpgradeId,
  type State,
} from "./simulation";
import { getObstacles } from "./world";
import { DEFAULT_RUN_CONFIG } from "./progression";
const still = { x: 0, z: 0 };
// Base weapon checks isolate robot damage bonuses, which expansion.test.ts covers.
function playing() {
  const s = createState({ ...DEFAULT_RUN_CONFIG, damageMultiplier: 1 });
  s.phase = "playing";
  s.openingRemaining = 0;
  s.scrap = 6;
  s.pickups = [];
  s.enemies = [];
  s.spawnTimer = 100;
  return s;
}
function enemy(
  id: number,
  x: number,
  z: number,
  hp = 10,
  type: Enemy["type"] = "can",
): Enemy {
  return { id, x, z, hp, hit: 0, seed: 0, type };
}
function collectXP(s: State, amount: number) {
  s.pickups.push({ id: 999, ...s.player, kind: "xp", born: -1, value: amount });
  update(s, 0.01, still);
}

test("launch spends the orbit and obeys cooldown and all paused phases", () => {
  const s = playing();
  s.phase = "ready";
  assert.equal(launch(s), false);
  s.phase = "playing";
  assert.equal(launch(s), true);
  assert.equal(s.scrap, 0);
  assert.equal(s.shots.length, 6);
  s.scrap = 4;
  assert.equal(launch(s), false);
  s.cooldown = 0;
  for (const phase of ["paused", "upgrade", "lost"] as const) {
    s.phase = phase;
    assert.equal(launch(s), false);
  }
});

test("movement normalizes diagonals, leaves the old arena, and faces travel independently of aim", () => {
  const a = playing(),
    b = playing();
  a.aim = { x: 0, z: -1 };
  update(a, 0.05, { x: 1, z: 0 });
  update(b, 0.05, { x: 1, z: 1 });
  assert.ok(Math.abs(Math.hypot(b.player.x, b.player.z) - a.player.x) < 1e-9);
  assert.ok(Math.abs(a.player.x - 0.31) < 1e-9);
  assert.deepEqual(a.facing, { x: 1, z: 0 });
  assert.deepEqual(a.aim, { x: 0, z: -1 });
  for (let i = 0; i < 200; i++) update(a, 0.05, { x: 1, z: 0 });
  assert.ok(a.player.x > 50);
  update(a, 0.01, still);
  assert.deepEqual(a.facing, { x: 1, z: 0 });
});

test("player cannot cross a visible circular obstacle", () => {
  const s = playing(),
    o = getObstacles(20, 20)[0];
  assert.ok(o);
  s.player = { x: o.x - o.radius - 0.5, z: o.z };
  for (let i = 0; i < 30; i++) update(s, 0.05, { x: 1, z: 0 });
  assert.ok(s.player.x <= o.x - o.radius - 0.39);
});

test("paused and upgrade phases freeze the complete simulation", () => {
  for (const phase of ["paused", "upgrade"] as const) {
    const s = createState();
    s.phase = phase;
    const before = structuredClone(s);
    update(s, 0.05, { x: 1, z: 0 });
    assert.deepEqual(s, before);
  }
});

test("XP offers three distinct valid choices and carries excess across consecutive levels", () => {
  const s = playing();
  collectXP(s, 30);
  assert.equal(s.phase, "upgrade");
  assert.equal(s.level, 2);
  assert.equal(s.xp, 25);
  assert.equal(s.xpNeeded, 9);
  for (let i = 0; i < 3; i++) {
    assert.equal(s.choices.length, 3);
    assert.equal(new Set(s.choices).size, 3);
    for (const id of s.choices)
      assert.ok(s.upgrades[id] < UPGRADES[id].maxRank);
    const pick = s.choices[0],
      before = s.upgrades[pick];
    assert.equal(chooseUpgrade(s, pick), true);
    assert.equal(s.upgrades[pick], before + 1);
  }
  assert.equal(s.level, 4);
  assert.equal(s.xp, 3);
  assert.equal(s.xpNeeded, 17);
  assert.equal(s.phase, "playing");
  assert.equal(chooseUpgrade(s, "saw"), false);
});

test("fully ranked builds retain three repeatable choices without deadlocking", () => {
  const s = playing();
  for (const id of Object.keys(UPGRADES) as UpgradeId[])
    if (Number.isFinite(UPGRADES[id].maxRank))
      s.upgrades[id] = UPGRADES[id].maxRank;
  s.hp = 30;
  collectXP(s, 5);
  assert.deepEqual([...s.choices].sort(), ["overclock", "refill", "repair"]);
  assert.equal(chooseUpgrade(s, "saw"), false);
  assert.equal(chooseUpgrade(s, "repair"), true);
  assert.equal(s.hp, 65);
  s.scrap = 0;
  collectXP(s, s.xpNeeded);
  assert.equal(chooseUpgrade(s, "refill"), true);
  assert.equal(s.scrap, MAX_SCRAP);
  collectXP(s, s.xpNeeded);
  assert.equal(chooseUpgrade(s, "overclock"), true);
  assert.equal(s.overclockTimer, 20);
});

test("scrap capacity preserves merged surplus while XP still collects", () => {
  const s = playing();
  s.scrap = MAX_SCRAP - 1;
  s.pickups = [
    { id: 90, ...still, kind: "scrap", born: -1, value: 8 },
    { id: 91, ...still, kind: "xp", born: -1 },
  ];
  update(s, 0.01, still);
  assert.equal(s.scrap, MAX_SCRAP);
  assert.equal(s.xp, 1);
  assert.equal(s.pickups.length, 1);
  assert.equal(s.pickups[0].value, 7);
});

test("empty orbit pulse can kill and recover scrap automatically", () => {
  const s = playing();
  s.scrap = 0;
  s.enemies = [enemy(99, 1.1, 0, 1)];
  s.pulseTimer = 0;
  update(s, 0.01, still);
  assert.equal(s.kills, 1);
  assert.equal(s.pickups.length, 3);
  for (let i = 0; i < 80; i++) update(s, 0.02, still);
  assert.equal(s.scrap, 2);
  assert.equal(s.xp, 1);
});

test("orbit hits kill once; the 36th kill does not finish an endless run", () => {
  const s = playing();
  s.kills = 35;
  const p = orbitPosition(s, 0);
  s.enemies = [enemy(99, p.x, p.z, 1)];
  update(s, 0.001, still);
  assert.equal(s.kills, 36);
  assert.equal(s.pickups.length, 3);
  assert.equal(s.phase, "playing");
  s.spawnTimer = 0;
  update(s, 0.01, still);
  assert.ok(s.enemies.length > 0);
});

test("fast projectiles use swept collision", () => {
  const s = playing();
  s.enemies = [enemy(99, 2, 0, 3)];
  s.scrap = 0;
  s.pulseTimer = 100;
  s.shots = [{ id: 98, x: 1.6, z: 0, vx: 17, vz: 0, life: 1, kind: 0 }];
  update(s, 0.05, still);
  assert.equal(s.kills, 1);
  assert.equal(s.shots.length, 0);
});

test("chain lightning hits different targets and emits connected segments", () => {
  const s = playing();
  s.scrap = 0;
  s.pulseTimer = 100;
  s.upgrades.lightning = 1;
  s.enemies = [enemy(101, 4, 0), enemy(102, 6, 0)];
  update(s, 0.01, still);
  assert.deepEqual(
    s.enemies.map((e) => e.hp),
    [6, 6],
  );
  const arcs = s.events.filter((e) => e.kind === "lightning");
  assert.equal(arcs.length, 2);
  assert.equal(arcs[0].fromX, 0);
  assert.ok((arcs[1].fromX ?? 0) > 3.9);
});

test("turrets deploy at world positions, fire, and expire; burst damages and pushes", () => {
  const s = playing();
  s.scrap = 0;
  s.pulseTimer = 100;
  s.upgrades.turret = 1;
  s.enemies = [enemy(101, 5, 0)];
  update(s, 0.01, still);
  assert.equal(s.turrets.length, 1);
  assert.equal(s.shots.length, 1);
  const x = s.turrets[0].x;
  update(s, 0.05, { x: 1, z: 0 });
  assert.equal(s.turrets[0].x, x);
  s.turrets[0].life = 0.001;
  update(s, 0.01, still);
  assert.equal(s.turrets.length, 0);
  const b = playing();
  b.scrap = 0;
  b.pulseTimer = 100;
  b.upgrades.burst = 1;
  b.enemies = [enemy(101, 2, 0)];
  update(b, 0.01, still);
  assert.equal(b.enemies[0].hp, 6);
  assert.ok(b.enemies[0].x > 3);
  assert.ok(
    b.events.some(
      (e) => e.kind === "burst" && Math.abs((e.radius ?? 0) - 3.2) < 1e-9,
    ),
  );
});

test("armor reduces contact damage and fatal contact ends the run", () => {
  const s = playing();
  s.scrap = 0;
  s.upgrades.armor = 2;
  s.enemies = [enemy(98, 0.1, 0)];
  update(s, 0.01, still);
  assert.equal(s.hp, 95);
  const lost = playing();
  lost.hp = 9;
  lost.scrap = 0;
  lost.enemies = [enemy(98, 0.1, 0)];
  update(lost, 0.01, still);
  assert.equal(lost.phase, "lost");
  assert.equal(lost.hp, 0);
  const time = lost.time;
  update(lost, 0.05, still);
  assert.equal(lost.time, time);
});

test("time escalates enemy types and pressure; entity pools remain bounded", () => {
  const s = playing();
  s.time = 300;
  s.immunity = 1000;
  for (let i = 0; i < 200; i++) {
    s.spawnTimer = 0;
    update(s, 0.01, still);
  }
  assert.equal(s.enemies.length, ENTITY_LIMITS.enemies);
  assert.ok(s.enemies.some((e) => e.type === "runner"));
  assert.ok(s.enemies.some((e) => e.type === "brute"));
  assert.ok(s.spawnTimer < 0.4);
  assert.equal(s.wave, 11);
  assert.ok(s.events.length <= ENTITY_LIMITS.events);
});

test("pickup cap merges drops without losing XP or scrap value", () => {
  const s = playing();
  s.pickups = Array.from({ length: ENTITY_LIMITS.pickups }, (_, i) => ({
    id: 200 + i,
    x: 50,
    z: 50,
    kind: i % 2 ? ("xp" as const) : ("scrap" as const),
    born: -1,
  }));
  const p = orbitPosition(s, 0);
  s.enemies = [enemy(99, p.x, p.z, 1, "brute")];
  update(s, 0.001, still);
  assert.equal(s.kills, 1);
  assert.equal(s.pickups.length, ENTITY_LIMITS.pickups);
  assert.equal(
    s.pickups
      .filter((p) => p.kind === "xp")
      .reduce((sum, p) => sum + (p.value ?? 1), 0),
    ENTITY_LIMITS.pickups / 2 + 4,
  );
  assert.equal(
    s.pickups
      .filter((p) => p.kind === "scrap")
      .reduce((sum, p) => sum + (p.value ?? 1), 0),
    ENTITY_LIMITS.pickups / 2 + 2,
  );
});

test("a saturated pool of distant drops keeps new kill rewards locally collectible", () => {
  const s = playing();
  s.scrap = 0;
  s.pulseTimer = 0;
  s.pickups = Array.from({ length: ENTITY_LIMITS.pickups }, (_, i) => ({
    id: 200 + i,
    x: 100 + (i % 10),
    z: 100,
    kind: i % 2 ? ("xp" as const) : ("scrap" as const),
    born: -1,
  }));
  s.enemies = [enemy(99, 1.1, 0, 1)];
  update(s, 0.01, still);
  assert.equal(s.pickups.length, ENTITY_LIMITS.pickups);
  assert.ok(s.pickups.some((p) => p.kind === "xp" && Math.hypot(p.x, p.z) < 2));
  assert.ok(
    s.pickups.some((p) => p.kind === "scrap" && Math.hypot(p.x, p.z) < 2),
  );
  for (let i = 0; i < 80; i++) update(s, 0.02, still);
  assert.equal(s.xp, 1);
  assert.equal(s.scrap, 2);
  assert.equal(
    s.pickups
      .filter((p) => p.kind === "xp")
      .reduce((sum, p) => sum + (p.value ?? 1), 0),
    ENTITY_LIMITS.pickups / 2,
  );
  assert.equal(
    s.pickups
      .filter((p) => p.kind === "scrap")
      .reduce((sum, p) => sum + (p.value ?? 1), 0),
    ENTITY_LIMITS.pickups / 2,
  );
  assert.ok(s.pickups.every((p) => p.x >= 100 && p.z === 100));
});

test("automatic volleys aim from each orbit piece at the nearest living enemy", () => {
  const s = playing();
  s.enemies = [
    enemy(100, -2, 0, 0),
    enemy(101, 7, 0, 100),
    enemy(102, 0, -5, 100),
  ];
  s.pulseTimer = 100;
  update(s, 0.01, { x: 1, z: 0 });
  assert.equal(s.launched, 1);
  assert.equal(s.scrap, 0);
  assert.equal(s.shots.length, 6);
  assert.ok(s.aim.z < -0.99, "Targeting ignores travel direction");
  assert.deepEqual(s.facing, { x: 1, z: 0 });
  const target = s.enemies.find((e) => e.id === 102)!;
  for (const shot of s.shots) {
    const dx = target.x - shot.x,
      dz = target.z - shot.z;
    assert.ok(
      Math.abs(dx * shot.vz - dz * shot.vx) < 1e-8,
      "Each shot converges on its target",
    );
  }
  s.scrap = 2;
  for (let i = 0; i < 20; i++) update(s, 0.05, still);
  assert.equal(s.launched, 1, "Cooldown prevents early repeat fire");
  for (let i = 0; i < 4; i++) update(s, 0.05, still);
  assert.equal(s.launched, 2, "Reloaded scrap fires again automatically");
  assert.ok(
    s.enemies.find((e) => e.id === 102)!.hp < 100,
    "Automatic projectiles hit",
  );
});

test("automatic fire saves ammunition without an in-range target and respects pause and capacity", () => {
  const s = playing();
  s.enemies = [enemy(100, 15, 0)];
  update(s, 0.05, still);
  assert.equal(s.launched, 0);
  assert.equal(s.scrap, 6);
  s.enemies = [enemy(100, 5, 0)];
  for (const phase of ["ready", "paused", "upgrade", "lost"] as const) {
    s.phase = phase;
    const before = structuredClone(s);
    update(s, 0.05, still);
    assert.deepEqual(s, before);
  }
  s.phase = "playing";
  s.shots = Array.from({ length: ENTITY_LIMITS.shots }, (_, i) => ({
    id: 200 + i,
    x: 100,
    z: 100,
    vx: 1,
    vz: 0,
    life: 1,
    kind: 0,
  }));
  update(s, 0.01, still);
  assert.equal(s.scrap, 6);
  assert.equal(s.launched, 0);
  s.shots = [];
  update(s, 0.01, still);
  assert.equal(s.launched, 1);
});

test("fresh enemies move immediately and spawns advance during the pickup introduction", () => {
  const s = createState();
  s.phase = "playing";
  const original = structuredClone(s.enemies),
    spawned = s.spawned;
  update(s, 0.05, still);
  assert.ok(s.openingRemaining > 0);
  assert.ok(s.spawnTimer < 1.3);
  for (const e of s.enemies) {
    const before = original.find((o) => o.id === e.id)!;
    assert.ok(Math.hypot(e.x, e.z) < Math.hypot(before.x, before.z));
  }
  for (let i = 0; i < 27; i++) update(s, 0.05, still);
  assert.ok(s.spawned > spawned, "New enemies do not wait for the guide");
});

test("real scrap is visibly gathered and fires before the introduction ends", () => {
  const s = createState();
  s.phase = "playing";
  s.enemies = [];
  s.spawnTimer = Infinity;
  assert.equal(s.scrap, 0);
  assert.equal(s.pickups.length, 6);
  for (let i = 0; i < 12; i++) update(s, 0.05, still);
  assert.equal(s.scrap, 0);
  for (let i = 0; i < 18; i++) update(s, 0.05, still);
  assert.equal(s.scrap, 6);
  assert.equal(s.pickups.length, 0);
  assert.ok(s.openingRemaining > 0);
  s.enemies = [enemy(999, 5, 0, 100)];
  update(s, 0.05, still);
  assert.equal(s.launched, 1, "No opening cooldown blocks automatic fire");
  assert.equal(s.scrap, 0);
});

test("movement, contact damage and abilities are active on the first frame", () => {
  const s = createState();
  s.phase = "playing";
  s.enemies = [enemy(999, 0, 0, 100), enemy(998, 5, 0, 100)];
  s.scrap = 6;
  s.pulseTimer = 0;
  s.spawnTimer = 0;
  s.upgrades.lightning = 1;
  s.upgrades.turret = 1;
  s.upgrades.burst = 1;
  update(s, 0.05, { x: 1, z: 0 });
  assert.ok(Math.abs(s.player.x - 0.31) < 1e-9);
  assert.equal(s.hp, 91);
  assert.equal(s.launched, 1);
  assert.equal(s.turrets.length, 1);
  assert.ok(s.spawnTimer > 0);
  assert.ok(s.events.some((e) => e.kind === "lightning"));
  assert.ok(s.events.some((e) => e.kind === "burst"));
});

test("pause freezes opening and a fresh restart restores uncollected ground scrap", () => {
  const s = createState();
  s.phase = "playing";
  for (let i = 0; i < 20; i++) update(s, 0.05, still);
  s.phase = "paused";
  const paused = structuredClone(s);
  for (let i = 0; i < 40; i++) update(s, 0.05, { x: 1, z: 1 });
  assert.deepEqual(s, paused);
  s.phase = "playing";
  update(s, 0.05, still);
  assert.ok(s.openingRemaining < paused.openingRemaining);
  const restarted = createState();
  assert.equal(restarted.openingRemaining, OPENING_DURATION);
  assert.equal(restarted.scrap, 0);
  assert.equal(restarted.time, 0);
  assert.equal(restarted.pickups.length, 6);
  assert.ok(
    restarted.pickups.every((p) => Math.abs(Math.hypot(p.x, p.z) - 2.4) < 1e-8),
  );
});
