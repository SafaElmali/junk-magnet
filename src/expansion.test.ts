import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseUpgrade,
  createState,
  ENTITY_LIMITS,
  orbitPosition,
  update,
  type Enemy,
  type State,
} from "./simulation";
import { DEFAULT_RUN_CONFIG, type RunConfig } from "./progression";
import { ENCOUNTER_LIMITS } from "./encounters";
import { DISCOVERY_LIMITS } from "./discovery";
import { EVOLUTIONS, type EvolutionId } from "./evolution-core";

// Deliberate simulation fixtures: no browser hooks, no claim these represent a normal starting run.
function isolated(config: RunConfig = DEFAULT_RUN_CONFIG) {
  const s = createState(config);
  s.phase = "playing";
  s.openingRemaining = 0;
  s.enemies = [];
  s.pickups = [];
  s.spawnTimer = Infinity;
  s.pulseTimer = Infinity;
  s.encounters.nextAt = Infinity;
  return s;
}
function enemy(
  s: State,
  type: Enemy["type"],
  x: number,
  z = 0,
  hp = 100,
): Enemy {
  const e = { id: s.nextId++, type, x, z, hp, seed: 0, hit: 0 };
  s.enemies.push(e);
  return e;
}
const idle = { x: 0, z: 0 };

test("scheduled boss real projectile kill grants health, ammo, XP and parts only once", () => {
  for (const [time, type, parts, healing, ammo, xp] of [
    [90, "miniboss", 15, 10, 6, 12],
    [180, "boss", 40, 20, 12, 30],
  ] as const) {
    const s = isolated();
    s.time = time;
    s.encounters.nextAt = time;
    update(s, 0.05, idle);
    const boss = s.enemies.find((e) => e.type === type)!;
    assert.ok(boss);
    boss.x = 5;
    boss.z = 0;
    boss.hp = 1;
    s.hp = 40;
    s.cooldown = 10;
    s.shots.push({
      id: s.nextId++,
      x: 5,
      z: 0,
      vx: 0,
      vz: 0,
      life: 1,
      kind: 0,
      damage: 10,
    });
    update(s, 0.05, idle);
    assert.equal(s.earnedParts, parts);
    assert.equal(s.hp, 40 + healing);
    assert.equal(s.scrap, ammo);
    assert.equal(s.encounters.active, null);
    assert.equal(s.encounters.defeated, 1);
    assert.equal(
      s.pickups
        .filter((p) => p.kind === "xp")
        .reduce((sum, p) => sum + (p.value ?? 1), 0),
      xp + 1,
    );
    update(s, 0.05, idle);
    assert.equal(s.earnedParts, parts);
    assert.equal(s.encounters.defeated, 1);
  }
});

test("saturated real horde yields one slot to a scheduled boss without exceeding entity cap", () => {
  const s = isolated();
  s.time = 180;
  s.encounters.nextAt = 180;
  for (let i = 0; i < ENTITY_LIMITS.enemies; i++)
    enemy(s, "can", 15 + (i % 10), Math.floor(i / 10));
  update(s, 0.05, idle);
  assert.equal(s.enemies.length, ENTITY_LIMITS.enemies);
  assert.equal(s.enemies.filter((e) => e.type === "boss").length, 1);
});

test("hazards share armor reduction and invulnerability with contact hits", () => {
  const s = isolated({ ...DEFAULT_RUN_CONFIG, damageReduction: 3 });
  s.upgrades.armor = 2;
  s.encounters.zones.push({ x: 0, z: 0, radius: 2, damage: 20, life: 3 });
  enemy(s, "can", 0.5);
  update(s, 0.05, idle);
  assert.equal(s.hp, 87); // 20 - 4 armor - 3 permanent armor, no second contact hit.
  for (let i = 0; i < 10; i++) update(s, 0.05, idle);
  assert.equal(s.hp, 87);
});

test("lethal contact ends the run before orbit damage can award a healing boss kill", () => {
  const s = isolated();
  s.hp = 1;
  s.scrap = 1;
  s.cooldown = 10;
  // Place one low-health mini boss between player and next-frame orbit blade.
  s.time = 0;
  const future = { ...s, time: 0.05 };
  const orbit = orbitPosition(future, 0);
  const boss = enemy(s, "miniboss", orbit.x * 0.62, orbit.z * 0.62, 0.1);
  s.encounters.active = { id: boss.id, type: "miniboss", maxHp: 85 };
  update(s, 0.05, idle);
  assert.equal(s.phase, "lost");
  assert.equal(s.hp, 0);
  assert.equal(s.earnedParts, 0);
});

test("recycling a distant attacker cancels its stale warning and resets windup", () => {
  const s = isolated();
  const attacker = enemy(s, "charger", 7);
  for (let i = 0; i < 24; i++) update(s, 0.05, idle);
  const warning = s.encounters.warnings[0];
  assert.ok(warning);
  s.player.x = 100;
  update(s, 0.05, idle);
  assert.ok(!s.encounters.warnings.some((w) => w.id === warning.id));
  assert.ok(Math.hypot(attacker.x - s.player.x, attacker.z - s.player.z) < 30);
  assert.ok(s.encounters.brains.get(attacker.id)!.cooldown > 0);
});

test("actual simulation freezes every expansion system during pause and upgrade choice", () => {
  const s = isolated();
  enemy(s, "spitter", 7);
  for (let i = 0; i < 24; i++) update(s, 0.05, idle);
  assert.ok(s.encounters.warnings.length);
  for (const phase of ["paused", "upgrade"] as const) {
    s.phase = phase;
    const before = structuredClone(s);
    update(s, 1, { x: 1, z: 1 });
    assert.deepEqual(s, before);
  }
});

test("choosing the prerequisite rank unlocks each evolution and leaves no duplicate notice", () => {
  for (const id of Object.keys(EVOLUTIONS) as EvolutionId[]) {
    const s = isolated(),
      recipe = EVOLUTIONS[id];
    s.upgrades[recipe.weapon] = recipe.weaponRank - 1;
    s.upgrades[recipe.support] = recipe.supportRank;
    s.phase = "upgrade";
    s.choices = [recipe.weapon];
    assert.equal(chooseUpgrade(s, recipe.weapon), true);
    assert.equal(s.evolutions[id], true);
    assert.equal(s.evolutionNotice?.id, id);
    const notice = s.evolutionNotice;
    s.phase = "upgrade";
    s.choices = ["refill"];
    chooseUpgrade(s, "refill");
    assert.deepEqual(s.evolutionNotice, notice);
  }
});

test("cyclone deals automatic damage with no scrap and storm reaches enemies beyond base range", () => {
  const s = isolated();
  s.evolutions.vortex = true;
  const target = enemy(s, "can", 3);
  update(s, 0.05, idle);
  assert.equal(target.hp, 100 - 8 * s.config.damageMultiplier);
  assert.equal(s.scrap, 0);
  const base = isolated(),
    storm = isolated();
  for (const state of [base, storm]) {
    state.upgrades.lightning = 5;
    enemy(state, "can", 8);
  }
  storm.evolutions.storm = true;
  update(base, 0.05, idle);
  update(storm, 0.05, idle);
  assert.equal(base.enemies[0].hp, 100);
  assert.ok(storm.enemies[0].hp < 100);
  assert.equal(
    storm.abilityTimers.lightning,
    base.abilityTimers.lightning * 0.5,
  );
});

test("bastion upgrades spawned turret lifetime, piercing and fire rate", () => {
  const base = isolated(),
    evolved = isolated();
  for (const s of [base, evolved]) {
    s.upgrades.turret = 5;
    enemy(s, "can", 7);
  }
  evolved.evolutions.fortress = true;
  update(base, 0.05, idle);
  update(evolved, 0.05, idle);
  assert.equal(evolved.turrets[0].life, base.turrets[0].life + 8);
  assert.equal(evolved.shots[0].pierce, 2);
  assert.equal(base.shots[0].pierce, 0);
  assert.equal(evolved.shots[0].damage, base.shots[0].damage! + 6);
  assert.equal(evolved.turrets[0].fireTimer, base.turrets[0].fireTimer * 0.7);
});

test("piercing shot damages exactly three different enemies, never repeating a target", () => {
  const s = isolated();
  const targets = [2.5, 3.3, 4.1, 4.9].map((x) => enemy(s, "can", x));
  s.shots.push({
    id: s.nextId++,
    x: 1,
    z: 0,
    vx: 8,
    vz: 0,
    life: 1,
    kind: 1,
    damage: 10,
    pierce: 2,
    hitIds: [],
  });
  for (let i = 0; i < 20; i++) update(s, 0.05, idle);
  const damaged = targets.filter((e) => e.hp < 100);
  assert.equal(damaged.length, 3);
  for (const e of damaged)
    assert.equal(e.hp, 100 - 10 * s.config.damageMultiplier);
});

test("run configuration is copied and applies speed, pickup range, weapon and damage passives", () => {
  const config: RunConfig = {
    ...DEFAULT_RUN_CONFIG,
    robotId: "volt",
    startingWeapon: "lightning",
    speedMultiplier: 0.95,
    pickupBonus: 1,
    damageMultiplier: 1.15,
  };
  const s = isolated(config);
  config.speedMultiplier = 9;
  assert.equal(s.config.speedMultiplier, 0.95);
  assert.equal(s.upgrades.saw, 0);
  assert.equal(s.upgrades.lightning, 1);
  const target = enemy(s, "can", 5);
  s.pickups.push({ id: s.nextId++, x: 3.9, z: 0, kind: "xp", born: -1 });
  update(s, 0.05, { x: 0, z: 1 });
  assert.ok(Math.abs(s.player.z - 6.2 * 0.95 * 0.05) < 1e-9);
  assert.equal(target.hp, 100 - 4 * 1.15);
  assert.ok(s.pickups[0].x < 3.9);
});

test("late-run deterministic soak keeps all systems bounded with advanced enemies and full upgrades", (t) => {
  const s = createState();
  s.phase = "playing";
  s.openingRemaining = 0;
  s.time = 600;
  s.upgrades = {
    saw: 5,
    lightning: 5,
    turret: 5,
    burst: 5,
    boots: 4,
    magnet: 4,
    armor: 4,
    drone_collector: 3,
    drone_repair: 3,
    drone_guard: 3,
    repair: 0,
    refill: 0,
    overclock: 0,
  };
  s.evolutions = { vortex: true, storm: true, fortress: true };
  s.hp = 100;
  s.immunity = 1000; // Explicit durability fixture; does not claim normal play survival.
  // Stress every advanced AI independently of the flight path's kill timing.
  // Scheduling has dedicated checks above: a living encounter intentionally blocks
  // later slots, so a five-minute evasive orbit need not naturally spawn both bosses.
  for (const [index, type] of (["charger", "spitter", "warden", "miniboss", "boss"] as const).entries()) {
    const angle = index * Math.PI * 2 / 5;
    enemy(s, type, Math.cos(angle) * 15, Math.sin(angle) * 15, 300);
  }
  const seen = new Set<string>();
  let peaks = { enemies: 0, warnings: 0, projectiles: 0, zones: 0 };
  for (let frame = 0; frame < 6000; frame++) {
    if ((s.phase as State["phase"]) === "upgrade")
      chooseUpgrade(s, s.choices[0]);
    const angle = frame * 0.002;
    update(s, 0.05, { x: Math.cos(angle), z: Math.sin(angle) });
    for (const e of s.enemies) seen.add(e.type);
    assert.ok(s.enemies.length <= ENTITY_LIMITS.enemies);
    assert.ok(s.pickups.length <= ENTITY_LIMITS.pickups);
    assert.ok(s.shots.length <= ENTITY_LIMITS.shots);
    assert.ok(s.turrets.length <= ENTITY_LIMITS.turrets);
    assert.ok(s.encounters.warnings.length <= ENCOUNTER_LIMITS.warnings);
    assert.ok(s.encounters.projectiles.length <= ENCOUNTER_LIMITS.projectiles);
    assert.ok(s.encounters.zones.length <= ENCOUNTER_LIMITS.zones);
    assert.ok(s.encounters.brains.size <= ENCOUNTER_LIMITS.brains);
    assert.ok(s.discovery.points.length <= DISCOVERY_LIMITS.points);
    assert.ok(s.discovery.consumed.size <= DISCOVERY_LIMITS.sectors);
    assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.z));
    assert.notEqual(s.phase, "lost");
    peaks = {
      enemies: Math.max(peaks.enemies, s.enemies.length),
      warnings: Math.max(peaks.warnings, s.encounters.warnings.length),
      projectiles: Math.max(peaks.projectiles, s.encounters.projectiles.length),
      zones: Math.max(peaks.zones, s.encounters.zones.length),
    };
    s.events.length = 0; // Renderer normally consumes this bounded event queue.
  }
  for (const type of ["charger", "spitter", "warden", "miniboss", "boss"])
    assert.ok(seen.has(type), `missing ${type}`);
  assert.ok(peaks.enemies > 40);
  assert.ok(s.time >= 899);
  t.diagnostic(
    JSON.stringify({
      simulatedSeconds: s.time - 600,
      peaks,
      seen: [...seen],
      kills: s.kills,
      defeated: s.encounters.defeated,
    }),
  );
});
