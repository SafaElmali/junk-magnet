import test from "node:test";
import assert from "node:assert/strict";
import {
  banishChoice,
  canBanish,
  canRevive,
  chooseSpecialization,
  chooseUpgrade,
  createState,
  enemyRadius,
  MAX_SCRAP,
  rerollChoices,
  revive,
  REVIVE_HEALTH,
  REVIVE_IMMUNITY,
  REVIVE_RADIUS,
  SUPPLIES,
  update,
  UPGRADES,
  type Enemy,
  type State,
  type UpgradeId,
} from "./simulation";
import {
  DEFAULT_RUN_CONFIG,
  NO_MODIFIERS,
  type RunConfig,
} from "./progression";
import {
  FINAL_BOSS,
  updateEncounters,
  updateEnemyBehavior,
  type EncounterHooks,
} from "./encounters";
import { CLEAR_TIME, STAGES } from "./stages";
import { summarizeRun } from "./run-summary";
import { AudioCues } from "./audio";
import { createRunAnalytics } from "./run-analytics";

const idle = { x: 0, z: 0 };
const config = (overrides: Partial<RunConfig> = {}): RunConfig => ({
  ...DEFAULT_RUN_CONFIG,
  damageMultiplier: 1,
  ...overrides,
});
// Deliberate fixtures: a quiet yard where each rule can be observed on its own.
function isolated(overrides: Partial<RunConfig> = {}) {
  const s = createState(config(overrides));
  s.phase = "playing";
  s.openingRemaining = 0;
  s.enemies = [];
  s.pickups = [];
  s.spawnTimer = Infinity;
  s.pulseTimer = Infinity;
  s.encounters.nextAt = Infinity;
  return s;
}
function enemy(s: State, type: Enemy["type"], x: number, z = 0, hp = 100) {
  const e: Enemy = { id: s.nextId++, type, x, z, hp, seed: 0, hit: 0 };
  s.enemies.push(e);
  return e;
}
function collectXP(s: State, amount: number) {
  s.pickups.push({ id: s.nextId++, ...s.player, kind: "xp", born: -1, value: amount });
  update(s, 0.01, idle);
}
/** Opens the next level-up sheet, resolving any specialization prompt first. */
function nextSheet(s: State, pick: (s: State) => UpgradeId) {
  if (s.specializationChoices.length)
    chooseSpecialization(s, s.specializationChoices[0]);
  else if (s.phase === "upgrade") chooseUpgrade(s, pick(s));
  if (s.phase !== "upgrade") collectXP(s, s.xpNeeded);
}

test("reroll redraws every card away from the current ones, deterministically", () => {
  const open = () => {
    const s = isolated({ rerolls: 2 });
    collectXP(s, 5);
    return s;
  };
  const a = open(),
    b = open();
  const before = [...a.choices];
  assert.equal(a.phase, "upgrade");
  assert.equal(rerollChoices(a), true);
  assert.equal(a.choices.length, 3);
  assert.equal(new Set(a.choices).size, 3);
  assert.ok(a.choices.every((id) => !before.includes(id)));
  assert.equal(a.rerolls, 1);
  assert.equal(a.stats.rerollsUsed, 1);
  assert.equal(rerollChoices(b), true);
  assert.deepEqual(a.choices, b.choices, "same seed, same redraw");
  assert.equal(rerollChoices(a), true);
  assert.equal(rerollChoices(a), false, "no rerolls left");
  assert.equal(a.stats.rerollsUsed, 2);
  a.phase = "playing";
  assert.equal(rerollChoices(b), true);
  assert.equal(rerollChoices(a), false, "only on an open level-up");
});

test("a short pool rerolls into fresh cards first, then repeats current ones", () => {
  const s = isolated({
    rerolls: 1,
    modifiers: { ...NO_MODIFIERS, bannedUpgrades: [...SUPPLIES] },
  });
  const open = ["boots", "magnet", "armor", "turret"] as const;
  for (const id of Object.keys(UPGRADES) as UpgradeId[])
    if (!SUPPLIES.includes(id) && !(open as readonly string[]).includes(id))
      s.upgrades[id] = UPGRADES[id].maxRank;
  collectXP(s, 5);
  const before = [...s.choices];
  const fresh = open.find((id) => !before.includes(id))!;
  assert.equal(rerollChoices(s), true);
  assert.equal(s.choices.length, 3);
  assert.equal(new Set(s.choices).size, 3);
  assert.ok(s.choices.includes(fresh));
  assert.ok(s.choices.every((id) => !SUPPLIES.includes(id)), "bans hold");
});

test("banish removes an offered build upgrade from every later pool and refills its card", () => {
  const s = isolated({ banishes: 1 });
  collectXP(s, 5);
  const target = s.choices.find(canBanish)!,
    slot = s.choices.indexOf(target);
  assert.equal(banishChoice(s, "overclock"), false, "not on the sheet");
  assert.equal(banishChoice(s, target), true);
  assert.equal(s.choices.length, 3);
  assert.equal(new Set(s.choices).size, 3);
  assert.notEqual(s.choices[slot], target);
  assert.ok(!s.choices.includes(target));
  assert.deepEqual(s.banished, [target]);
  assert.equal(s.banishes, 0);
  assert.equal(s.stats.banishesUsed, 1);
  assert.equal(banishChoice(s, s.choices.find(canBanish)!), false, "none left");
  for (let i = 0; i < 40; i++) {
    nextSheet(s, (state) => state.choices[0]);
    assert.ok(!s.choices.includes(target), `level ${s.level}`);
  }
});

test("supplies cannot be banished and banned upgrades are never offered", () => {
  const s = isolated({
    banishes: 3,
    modifiers: { ...NO_MODIFIERS, bannedUpgrades: ["saw", "lightning"] },
  });
  for (const id of SUPPLIES) assert.equal(canBanish(id), false);
  for (let i = 0; i < 40; i++) {
    nextSheet(s, (state) => state.choices.at(-1)!);
    assert.ok(!s.choices.includes("saw") && !s.choices.includes("lightning"));
  }
  const maxed = isolated({ banishes: 1 });
  for (const id of Object.keys(UPGRADES) as UpgradeId[])
    if (Number.isFinite(UPGRADES[id].maxRank))
      maxed.upgrades[id] = UPGRADES[id].maxRank;
  maxed.hp = 30;
  collectXP(maxed, 5);
  assert.deepEqual([...maxed.choices].sort(), ["overclock", "refill", "repair"]);
  assert.equal(banishChoice(maxed, "repair"), false);
  assert.equal(maxed.banishes, 1);
});

test("a challenge that bans every supply still opens a playable level-up", () => {
  const s = isolated({
    banishes: 1,
    modifiers: { ...NO_MODIFIERS, bannedUpgrades: [...SUPPLIES] },
  });
  for (const id of Object.keys(UPGRADES) as UpgradeId[])
    if (Number.isFinite(UPGRADES[id].maxRank) && id !== "boots")
      s.upgrades[id] = UPGRADES[id].maxRank;
  collectXP(s, 5);
  assert.deepEqual(s.choices, ["boots"]);
  assert.equal(banishChoice(s, "boots"), true);
  assert.ok(s.choices.length > 0, "the sheet never empties");
  assert.equal(chooseUpgrade(s, s.choices[0]), true);
});

test("tools are unavailable on a specialization choice", () => {
  const s = isolated({ rerolls: 1, banishes: 1 });
  s.upgrades.saw = 2;
  s.phase = "upgrade";
  s.choices = ["saw", "boots", "magnet"];
  assert.equal(chooseUpgrade(s, "saw"), true);
  assert.ok(s.specializationChoices.length > 0);
  assert.equal(rerollChoices(s), false);
  assert.equal(banishChoice(s, "boots"), false);
  assert.equal(s.rerolls + s.banishes, 2);
});

test("lethal damage spends a revive: half health, immunity and a clearing shockwave", () => {
  const s = isolated({ revives: 1 });
  s.hp = 5;
  const near = enemy(s, "can", 0.5, 0, 500),
    far = enemy(s, "can", 14, 0, 500);
  s.encounters.projectiles.push(
    { x: 3, z: 0, vx: 0, vz: 0, life: 3, damage: 12 },
    { x: 20, z: 0, vx: 0, vz: 0, life: 3, damage: 12 },
  );
  s.encounters.zones.push(
    { x: 30, z: 0, radius: 2, life: 3, damage: 20 },
    { x: 1.5, z: 3, radius: 1, life: 3, damage: 20 },
  );
  assert.equal(canRevive(s), false, "only once health is gone");
  update(s, 0.05, idle);
  assert.equal(s.phase, "playing");
  assert.equal(s.hp, REVIVE_HEALTH);
  assert.equal(s.immunity, REVIVE_IMMUNITY);
  assert.equal(s.revives, 0);
  assert.equal(s.stats.revivesUsed, 1);
  assert.ok(near.hp < 500 && Math.hypot(near.x, near.z) > 3, "damaged and pushed");
  assert.equal(far.hp, 500);
  assert.deepEqual(s.encounters.projectiles.map((p) => p.x), [20]);
  assert.deepEqual(s.encounters.zones.map((z) => z.x), [30]);
  assert.ok(s.events.some((e) => e.kind === "burst" && e.radius === REVIVE_RADIUS));
  // Protected, then the next fall has no revive left.
  for (let i = 0; i < 20; i++) update(s, 0.05, idle);
  assert.equal(s.hp, REVIVE_HEALTH);
  s.immunity = 0;
  s.hp = 1;
  near.x = 0.3;
  near.z = 0;
  update(s, 0.05, idle);
  assert.equal(s.phase, "lost");
  assert.equal(s.stats.revivesUsed, 1);
});

test("an external revive reopens a lost run without spending automatic revives", () => {
  const s = isolated();
  s.hp = 1;
  enemy(s, "can", 0.3, 0, 500);
  update(s, 0.05, idle);
  assert.equal(s.phase, "lost");
  assert.equal(canRevive(s), false);
  assert.equal(revive(s), false, "automatic revives need a spare");
  assert.equal(revive(s, "external"), true);
  assert.equal(s.phase, "playing");
  assert.equal(s.hp, REVIVE_HEALTH);
  assert.equal(s.revives, 0);
  assert.equal(s.stats.revivesUsed, 1);
  assert.equal(revive(s, "external"), false, "the robot is standing");
  update(s, 0.05, idle);
  assert.equal(s.phase, "playing");
});

test("the 15:00 slot brings the Scrap Colossus scaled by the stage; defeating it wins", () => {
  for (const stage of ["yard", "night"] as const) {
    const s = isolated({ stage });
    s.time = CLEAR_TIME;
    s.encounters.nextAt = CLEAR_TIME;
    update(s, 0.05, idle);
    const boss = s.enemies.find((e) => e.final)!;
    assert.equal(boss.type, "boss");
    assert.equal(s.encounters.active?.final, true);
    const hp = FINAL_BOSS.health * STAGES[stage].bossHealth;
    assert.equal(s.encounters.active?.maxHp, hp);
    assert.equal(boss.hp, hp);
    assert.ok(enemyRadius(boss) > enemyRadius({ ...boss, final: false }));
    boss.hp = 1;
    s.xp = 1000;
    s.shots.push({ id: s.nextId++, x: boss.x, z: boss.z, vx: 0, vz: 0, life: 1, kind: 0, damage: 10 });
    update(s, 0.05, idle);
    assert.equal(s.phase, "won", stage);
    assert.equal(s.choices.length, 0, "no level-up after the clear");
    assert.equal(s.encounters.cleared, true);
    assert.equal(s.stats.bossKills, 1);
    assert.equal(s.earnedParts, FINAL_BOSS.parts);
    assert.equal(summarizeRun(s, "run")?.phase, "won");
    const time = s.time;
    update(s, 0.05, idle);
    assert.equal(s.time, time, "a cleared run is over");
  }
});

test("a living boss holds the final boss back until that fight ends", () => {
  const s = isolated();
  s.time = CLEAR_TIME;
  s.encounters.nextAt = CLEAR_TIME;
  const mini = enemy(s, "miniboss", 8);
  s.encounters.active = { id: mini.id, type: "miniboss", maxHp: 100 };
  update(s, 0.05, idle);
  assert.equal(s.enemies.some((e) => e.final), false);
  assert.equal(s.encounters.nextAt, CLEAR_TIME);
  mini.hp = 0;
  update(s, 0.05, idle);
  update(s, 0.05, idle);
  assert.equal(s.enemies.filter((e) => e.final).length, 1);
  // Later slots never add a second boss while the Colossus lives.
  s.time = CLEAR_TIME + 200;
  update(s, 0.05, idle);
  assert.equal(s.enemies.filter((e) => e.type === "boss" || e.type === "miniboss").length, 1);
});

test("the slot before 15:00 is capped so the final boss arrives on time", () => {
  const s = isolated();
  s.time = CLEAR_TIME - 90;
  s.encounters.nextAt = CLEAR_TIME - 90;
  update(s, 0.05, idle);
  assert.equal(s.encounters.active?.type, "miniboss");
  assert.equal(s.encounters.nextAt, CLEAR_TIME);
});

test("co-op keeps the endless yard: its 15:00 slot is an ordinary boss", () => {
  const s = isolated(),
    partner = isolated();
  s.time = CLEAR_TIME;
  s.encounters.nextAt = CLEAR_TIME;
  const hooks: EncounterHooks = {
    spawnEnemy: (type, position, hp) => enemy(s, type, position.x, position.z, hp),
    damagePlayer() {},
    reward() {},
  };
  updateEncounters(s, 0.05, hooks, [s, partner]);
  assert.equal(s.encounters.active?.type, "boss");
  assert.equal(s.encounters.active?.final, undefined);
  assert.equal(s.enemies.some((e) => e.final), false);
});

test("the Colossus cycles charges, bolt fans and zones faster than the Yard Titan", () => {
  const s = isolated();
  const boss = enemy(s, "boss", 7, 0, 5000);
  boss.final = true;
  s.encounters.active = { id: boss.id, type: "boss", maxHp: 5000, final: true };
  const hooks: EncounterHooks = { spawnEnemy: () => undefined, damagePlayer() {}, reward() {} };
  const kinds: string[] = [];
  let fan = 0,
    lastWarning = 0;
  for (let i = 0; i < 400 && kinds.length < 4; i++) {
    const before = s.encounters.projectiles.length;
    updateEnemyBehavior(s, boss, 0.05, hooks);
    fan = Math.max(fan, s.encounters.projectiles.length - before);
    const w = s.encounters.warnings.at(-1);
    if (w && w.id !== lastWarning) {
      lastWarning = w.id;
      kinds.push(w.kind);
      assert.ok(w.duration < 1.5, "shorter windup than the Titan");
    }
    // Keep the fight in range after each charge.
    boss.x = Math.min(Math.max(boss.x, -9), 9);
  }
  assert.deepEqual(kinds, ["charge", "bolt", "zone", "charge"]);
  assert.equal(fan, FINAL_BOSS.fan.length);
});

test("stage and challenge multipliers stack on enemy health, speed and spawn rate", () => {
  const challenge = {
    ...NO_MODIFIERS,
    enemyHealth: 1.5,
    enemySpeed: 1.2,
    spawnRate: 2,
  };
  const yard = createState(config()),
    night = createState(config({ stage: "night" })),
    hard = createState(config({ stage: "night", modifiers: challenge }));
  yard.enemies.forEach((e, i) => {
    assert.ok(Math.abs(night.enemies[i].hp - e.hp * STAGES.night.enemyHealth) < 1e-9);
    assert.ok(Math.abs(hard.enemies[i].hp - e.hp * STAGES.night.enemyHealth * 1.5) < 1e-9);
  });
  const moved = (overrides: Partial<RunConfig>) => {
    const s = isolated(overrides);
    const e = enemy(s, "can", 10, 0, 50);
    update(s, 0.05, idle);
    return 10 - e.x;
  };
  const base = moved({});
  assert.ok(Math.abs(moved({ stage: "night" }) / base - STAGES.night.enemySpeed) < 1e-9);
  assert.ok(Math.abs(moved({ stage: "night", modifiers: challenge }) / base - STAGES.night.enemySpeed * 1.2) < 1e-9);
  const interval = (overrides: Partial<RunConfig>, spawnMultiplier = 1) => {
    const s = isolated(overrides);
    s.spawnTimer = 0.001;
    update(s, 0.05, idle, { spawnMultiplier });
    return s.spawnTimer;
  };
  const normal = interval({});
  assert.ok(Math.abs(normal / interval({ stage: "night" }) - STAGES.night.spawnRate) < 1e-9);
  assert.ok(Math.abs(normal / interval({ stage: "night", modifiers: challenge }, 1.5) - STAGES.night.spawnRate * 2 * 1.5) < 1e-9);
  // Bosses follow the stage's boss health and the challenge's enemy health.
  const boss = isolated({ stage: "night", modifiers: challenge });
  boss.time = 180;
  boss.encounters.nextAt = 180;
  update(boss, 0.05, idle);
  assert.ok(Math.abs(boss.encounters.active!.maxHp - 220 * 1.35 * STAGES.night.bossHealth * 1.5) < 1e-9);
});

test("starting upgrades and scrap apply at the start within their caps", () => {
  const s = createState(
    config({
      startingScrap: 40,
      modifiers: {
        ...NO_MODIFIERS,
        startingUpgrades: { saw: 2, lightning: 9, armor: 1.7, repair: 3, boots: -2 },
      },
    }),
  );
  assert.equal(s.upgrades.saw, 3, "on top of the starting weapon");
  assert.equal(s.upgrades.lightning, UPGRADES.lightning.maxRank);
  assert.equal(s.upgrades.armor, 1);
  assert.equal(s.upgrades.repair, 0, "supplies are not build ranks");
  assert.equal(s.upgrades.boots, 0);
  assert.equal(s.scrap, MAX_SCRAP);
  assert.equal(createState(config({ startingScrap: 4 })).scrap, 4);
  const stale = config({
    modifiers: { ...NO_MODIFIERS, startingUpgrades: { retired: 2 } as never },
  });
  assert.doesNotThrow(() => createState(stale));
});

test("the XP multiplier banks fractions so displayed XP stays whole", () => {
  const s = isolated({ xpMultiplier: 1.5 });
  s.xpNeeded = 1000;
  const seen = [1, 3, 4, 6].map(() => {
    collectXP(s, 1);
    assert.ok(Number.isInteger(s.xp));
    return s.xp;
  });
  assert.deepEqual(seen, [1, 3, 4, 6]);
  const small = isolated({ xpMultiplier: 1.1 });
  small.xpNeeded = 1000;
  for (let i = 0; i < 10; i++) collectXP(small, 1);
  assert.equal(small.xp, 11);
  const plain = isolated();
  plain.xpNeeded = 1000;
  collectXP(plain, 7);
  assert.equal(plain.xp, 7);
  assert.equal(plain.xpFraction, 0);
});

test("audio plays a revive cue and a layered victory that outranks the boss reward", () => {
  const cues = new AudioCues(),
    s = isolated();
  cues.update(s);
  s.stats.revivesUsed = 1;
  assert.deepEqual(cues.update(s), ["repair"]);
  s.phase = "won";
  s.encounters.defeated++;
  assert.deepEqual(cues.update(s), ["evolve", "reward"]);
  assert.deepEqual(cues.update(structuredClone(s)), []);
});

test("analytics report a cleared stage once, with the stage, tools and the 15:00 milestone", () => {
  const events: { event: string; properties: Record<string, unknown> }[] = [];
  const analytics = createRunAnalytics((event, properties) => events.push({ event, properties }));
  const s = createState(config({ stage: "night" }));
  analytics.start("night-run", "solo", s);
  s.time = CLEAR_TIME + 5;
  analytics.observe(s);
  assert.ok(events.some((e) => e.event === "survival_milestone" && e.properties.milestone_seconds === CLEAR_TIME));
  Object.assign(s.stats, { revivesUsed: 1, rerollsUsed: 2, banishesUsed: 1, bossKills: 5 });
  s.phase = "won";
  analytics.complete(s, 150);
  analytics.complete(s, 150);
  const done = events.filter((e) => e.event === "run_completed");
  assert.equal(done.length, 1);
  assert.equal(done[0].properties.outcome, "cleared");
  assert.equal(done[0].properties.stage, "night");
  assert.equal(done[0].properties.parts_earned, 150);
  assert.equal(done[0].properties.revives_used, 1);
  assert.equal(done[0].properties.rerolls_used, 2);
  assert.equal(done[0].properties.banishes_used, 1);
  assert.equal(done[0].properties.boss_kills, 5);
  assert.equal(events[0].properties.stage, "night");
});
