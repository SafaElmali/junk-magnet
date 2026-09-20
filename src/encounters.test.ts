import assert from "node:assert/strict";
import test from "node:test";
import { createState, type Enemy } from "./simulation";
import {
  createEncounterState,
  ENCOUNTER_LIMITS,
  onEncounterKill,
  updateEncounters,
  updateEnemyBehavior,
  type EncounterHooks,
  type EncounterEnemyType,
} from "./encounters";

function fixture() {
  const s = createState();
  s.phase = "playing";
  s.openingRemaining = 0;
  s.enemies = [];
  s.encounters = createEncounterState();
  let damage = 0,
    rewards = 0,
    parts = 0;
  const hooks: EncounterHooks = {
    spawnEnemy(type, position, hp) {
      const e: Enemy = {
        ...position,
        hp,
        id: s.nextId++,
        type,
        hit: 0,
        seed: 0,
      };
      s.enemies.push(e);
      return e;
    },
    damagePlayer(amount) {
      damage += amount;
    },
    reward(reward) {
      rewards++;
      parts += reward.parts;
    },
  };
  const enemy = (type: EncounterEnemyType, x = 7, z = 0) =>
    hooks.spawnEnemy(type, { x, z }, 100)!;
  return {
    s,
    hooks,
    enemy,
    get damage() {
      return damage;
    },
    get rewards() {
      return rewards;
    },
    get parts() {
      return parts;
    },
  };
}

test("encounters alternate mini boss and boss without overlap, with escalating health and one reward", () => {
  const f = fixture();
  f.s.time = 90;
  updateEncounters(f.s, 0.05, f.hooks);
  assert.equal(f.s.encounters.active?.type, "miniboss");
  const first = f.s.enemies[0];
  const firstHp = first.hp;
  f.s.time = 180;
  updateEncounters(f.s, 0.05, f.hooks);
  assert.equal(f.s.enemies.length, 1);
  first.hp = 0;
  onEncounterKill(f.s, first, f.hooks);
  onEncounterKill(f.s, first, f.hooks);
  assert.equal(f.rewards, 1);
  assert.equal(f.parts, 15);
  f.s.time = 270;
  updateEncounters(f.s, 0.05, f.hooks);
  const second = f.s.enemies.at(-1)!;
  assert.equal(second.type, "miniboss");
  assert.ok(second.hp > firstHp);
  second.hp = 0;
  onEncounterKill(f.s, second, f.hooks);
  f.s.time = 360;
  updateEncounters(f.s, 0.05, f.hooks);
  const boss = f.s.enemies.at(-1)!;
  assert.equal(boss.type, "boss");
  boss.hp = 0;
  onEncounterKill(f.s, boss, f.hooks);
  assert.equal(f.parts, 70);
});

test("full enemy pool retries its scheduled boss", () => {
  const f = fixture();
  f.s.time = 90;
  updateEncounters(f.s, 0.05, { ...f.hooks, spawnEnemy: () => undefined });
  assert.equal(f.s.encounters.nextAt, 90);
  updateEncounters(f.s, 0.05, f.hooks);
  assert.equal(f.s.encounters.active?.type, "miniboss");
});

test("charger locks a visible warning before movement and does not track a dodging player", () => {
  const f = fixture(),
    e = f.enemy("charger");
  for (let i = 0; i < 24; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  const w = f.s.encounters.warnings[0];
  assert.ok(w);
  assert.equal(w.kind, "charge");
  const x = e.x;
  f.s.player.z = 8;
  for (let i = 0; i < 15; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  assert.equal(e.x, x);
  assert.equal(f.damage, 0);
  assert.equal(w.dz, 0);
  for (let i = 0; i < 16; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  assert.ok(e.x < x);
  assert.equal(e.z, 0);
  assert.equal(f.damage, 0);
});

test("ranged fire has a windup; player dodges locked projectile direction", () => {
  const f = fixture(),
    e = f.enemy("spitter");
  for (let i = 0; i < 24; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  assert.equal(f.s.encounters.warnings[0].kind, "bolt");
  assert.equal(f.s.encounters.projectiles.length, 0);
  f.s.player.z = 4;
  for (let i = 0; i < 22; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  assert.equal(f.s.encounters.projectiles.length, 1);
  assert.equal(f.s.encounters.projectiles[0].vz, 0);
  for (let i = 0; i < 80; i++) updateEncounters(f.s, 0.05, f.hooks);
  assert.equal(f.damage, 0);
  assert.equal(f.s.encounters.projectiles.length, 0);
});

test("area denial cannot damage during its warning and disappears after its lifetime", () => {
  const f = fixture(),
    e = f.enemy("warden");
  for (let i = 0; i < 24; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  assert.equal(f.s.encounters.warnings[0].kind, "zone");
  assert.equal(f.s.encounters.zones.length, 0);
  assert.equal(f.damage, 0);
  for (let i = 0; i < 22; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  updateEncounters(f.s, 0.05, f.hooks);
  assert.ok(f.damage > 0);
  f.s.player.x = 10;
  const damage = f.damage;
  for (let i = 0; i < 60; i++) updateEncounters(f.s, 0.05, f.hooks);
  assert.equal(f.damage, damage);
  assert.equal(f.s.encounters.zones.length, 0);
});

test("pause and upgrade freeze warnings, movement, scheduling and hazards", () => {
  const f = fixture(),
    e = f.enemy("boss");
  for (let i = 0; i < 24; i++) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
  for (const phase of ["paused", "upgrade"] as const) {
    f.s.phase = phase;
    f.s.time = 360;
    const before = JSON.stringify({ enemy: e, encounters: f.s.encounters });
    updateEncounters(f.s, 10, f.hooks);
    updateEnemyBehavior(f.s, e, 10, f.hooks);
    assert.equal(
      JSON.stringify({ enemy: e, encounters: f.s.encounters }),
      before,
    );
  }
});

test("large hordes retain bounded warning pools and clean dead brains", () => {
  const f = fixture();
  const enemies = Array.from({ length: 140 }, () => f.enemy("spitter"));
  for (let frame = 0; frame < 400; frame++) {
    for (const e of enemies) updateEnemyBehavior(f.s, e, 0.05, f.hooks);
    updateEncounters(f.s, 0.05, f.hooks);
    assert.ok(f.s.encounters.warnings.length <= ENCOUNTER_LIMITS.warnings);
    assert.ok(
      f.s.encounters.projectiles.length <= ENCOUNTER_LIMITS.projectiles,
    );
    assert.ok(f.s.encounters.brains.size <= ENCOUNTER_LIMITS.brains);
  }
  for (const e of enemies) e.hp = 0;
  updateEncounters(f.s, 0.05, f.hooks);
  assert.equal(f.s.encounters.brains.size, 0);
  assert.equal(f.s.encounters.warnings.length, 0);
});

test("guard slow affects special movement and charges without slowing attack clocks", () => {
  for (const type of ["charger", "spitter", "warden", "miniboss", "boss"] as const) {
    const normal = fixture(), slowed = fixture();
    const a = normal.enemy(type, 10), b = slowed.enemy(type, 10);
    b.slowUntil = 1;
    updateEnemyBehavior(normal.s, a, 0.1, normal.hooks);
    updateEnemyBehavior(slowed.s, b, 0.1, slowed.hooks);
    assert.ok(Math.abs((10 - a.x) / 2 - (10 - b.x)) < 1e-8, type);
    assert.equal(normal.s.encounters.brains.get(a.id)!.cooldown, slowed.s.encounters.brains.get(b.id)!.cooldown);
  }
  const f = fixture(), e = f.enemy("charger", 10);
  e.slowUntil = 1;
  f.s.encounters.brains.set(e.id, { cooldown: 1, dash: 0.5, dx: -1, dz: 0 });
  updateEnemyBehavior(f.s, e, 0.1, f.hooks);
  assert.equal(e.x, 9.4);
  assert.equal(f.s.encounters.brains.get(e.id)!.dash, 0.4);
});
