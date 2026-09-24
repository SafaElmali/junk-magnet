import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseUpgrade,
  createState,
  enemyRadius,
  launch,
  update,
  UPGRADES,
  type Enemy,
  type State,
  type UpgradeId,
} from "./simulation";
import { DEFAULT_RUN_CONFIG, NO_MODIFIERS, type RunConfig } from "./progression";
import {
  ARSENAL_LIMITS,
  ELITE,
  eliteChance,
  harpoonStats,
  slagStats,
} from "./arsenal";
import { CoopSession } from "./coop-session";
import { eventCue } from "./audio";
import { LANGUAGES, localizedUpgradeDescription, setLanguage, t } from "./i18n";
import { specializationCopy } from "./specialization-ui";
import { SPECIALIZATIONS, type SpecializationId } from "./specializations";

// Deliberate fixtures: no spawns, bosses or basic attacks unless a test adds them.
function isolated(config: RunConfig = DEFAULT_RUN_CONFIG) {
  const s = createState({ ...config, damageMultiplier: 1 });
  s.phase = "playing";
  s.openingRemaining = 0;
  s.enemies = [];
  s.pickups = [];
  s.spawnTimer = Infinity;
  s.pulseTimer = Infinity;
  s.encounters.nextAt = Infinity;
  s.immunity = 1000;
  return s;
}
function enemy(s: State, x: number, z = 0, hp = 100, type: Enemy["type"] = "can"): Enemy {
  const e: Enemy = { id: s.nextId++, type, x, z, hp, seed: 0, hit: 0 };
  s.enemies.push(e);
  return e;
}
const still = { x: 0, z: 0 };
function run(s: State, seconds: number, world = false) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++)
    update(s, 0.05, still, { world, deferDiscovery: true });
}

test("a harpoon flies 8 m along the heading, reels back and strikes each enemy once per pass", () => {
  const s = isolated();
  s.upgrades.harpoon = 1;
  s.facing = { x: 1, z: 0 };
  const near = enemy(s, 3),
    far = enemy(s, 7),
    beside = enemy(s, 3, 3),
    beyond = enemy(s, 9.5);
  run(s, 0.05);
  assert.equal(s.arsenal.harpoons.length, 1);
  run(s, 1.5);
  assert.equal(near.hp, 100 - 2 * 6);
  assert.equal(far.hp, 100 - 2 * 6);
  assert.equal(beside.hp, 100);
  assert.equal(beyond.hp, 100);
  assert.equal(s.arsenal.harpoons.length, 0, "the hook returned to the robot");
  assert.ok(s.arsenal.timers.harpoon > 0, "the next throw waits for its cooldown");
});

test("harpoon ranks add hooks in a spread, damage and faster throws; capacitor shortens the cooldown", () => {
  const s = isolated();
  s.upgrades.harpoon = 5;
  s.facing = { x: 0, z: 1 };
  run(s, 0.05);
  assert.equal(s.arsenal.harpoons.length, 3);
  const angles = s.arsenal.harpoons.map((h) => Math.atan2(h.dz, h.dx));
  assert.ok(Math.abs(angles[1] - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(angles[2] - angles[1] - 0.22) < 1e-9);
  assert.equal(s.arsenal.harpoons[0].damage, 16);
  assert.ok(Math.abs(s.arsenal.timers.harpoon - 1.5) < 1e-9);
  const charged = isolated();
  charged.upgrades.harpoon = 5;
  charged.upgrades.capacitor = 2;
  run(charged, 0.05);
  assert.ok(Math.abs(charged.arsenal.timers.harpoon - 1.5 * 0.84) < 1e-9);
  // New ranks fire at once, like the original weapons.
  const ranked = isolated();
  ranked.upgrades.harpoon = 1;
  run(ranked, 0.05);
  ranked.upgrades.harpoon = 2;
  run(ranked, 0.05);
  assert.equal(ranked.arsenal.harpoons.length, 3);
});

test("hook volley fans more, lighter hooks; anchor hook is single, heavy and knocks back all but bosses", () => {
  const s = isolated();
  s.upgrades.harpoon = 3;
  s.specializations.harpoon = "harpoon_volley";
  assert.deepEqual(
    [harpoonStats(s).hooks, harpoonStats(s).damage, harpoonStats(s).spread],
    [4, 11 * 0.6, 0.3],
  );
  const anchor = isolated();
  anchor.upgrades.harpoon = 5;
  anchor.specializations.harpoon = "harpoon_anchor";
  anchor.facing = { x: 1, z: 0 };
  assert.equal(harpoonStats(anchor).hooks, 1);
  const can = enemy(anchor, 3, 0, 1000),
    boss = enemy(anchor, 6, 0, 1000, "boss");
  run(anchor, 0.35);
  assert.ok(Math.abs(can.x - 4.2) < 1e-9, "pushed 1.2 m along the throw");
  assert.equal(can.hp, 1000 - 16 * 2.4);
  assert.ok(boss.hp < 1000);
  assert.equal(boss.x, 6);
});

test("scrap winch drags struck enemies back outside contact range and brings pickups home", () => {
  const s = isolated();
  s.upgrades.harpoon = 5;
  s.upgrades.magnet = 2;
  s.evolutions.winch = true;
  s.facing = { x: 1, z: 0 };
  const stats = harpoonStats(s);
  assert.deepEqual([stats.hooks, stats.range, stats.damage], [5, 10, 16 * 1.6]);
  assert.ok(Math.abs(stats.cooldown - 1.5 * 0.75) < 1e-9);
  const target = enemy(s, 9.3, 0, 1000);
  s.pickups.push({ id: s.nextId++, x: 7, z: 0.3, kind: "xp", born: -1, value: 3 });
  run(s, 1);
  const d = Math.hypot(target.x - s.player.x, target.z - s.player.z);
  assert.ok(d < 4.5 && d > enemyRadius(target) + 0.3, `dragged to ${d.toFixed(2)} m`);
  assert.equal(s.xp, 3);
  assert.equal(s.pickups.length, 0);
});

test("slag mortar lands on the densest group in range and leaves a burning puddle", () => {
  const s = isolated();
  s.upgrades.slag = 1;
  const group = [
    [6, 0],
    [6.4, 0.2],
    [5.7, -0.3],
    [6.1, 0.4],
  ].map(([x, z]) => enemy(s, x, z));
  const lone = enemy(s, -4, 0),
    distant = [0, 0.3, -0.3, 0.2, -0.2].map((z) => enemy(s, 14, z));
  run(s, 0.05);
  assert.equal(s.arsenal.shells.length, 1);
  const shell = s.arsenal.shells[0];
  assert.ok(Math.hypot(shell.toX - 6.05, shell.toZ - 0.075) < 0.01, "aims at the group centre");
  run(s, 0.65);
  assert.equal(s.arsenal.shells.length, 0);
  assert.equal(s.arsenal.puddles.length, 1);
  const puddle = s.arsenal.puddles[0];
  assert.ok(Math.abs(puddle.radius - 1) < 1e-9);
  for (const e of group) assert.ok(e.hp <= 100 - 3, "impact damage");
  assert.equal(lone.hp, 100);
  for (const e of distant) assert.equal(e.hp, 100);
  const afterImpact = group[0].hp;
  run(s, 0.5);
  assert.ok(Math.abs(afterImpact - group[0].hp - 0.34) < 1e-9, "one burn tick");
  run(s, 2);
  assert.equal(s.arsenal.puddles.length, 0, "the puddle cools");
});

test("cluster shells split between groups; a molten pool is wider and slows enemies inside", () => {
  const s = isolated();
  s.upgrades.slag = 3;
  s.specializations.slag = "slag_cluster";
  for (const x of [5, -5]) for (const z of [0, 0.4]) enemy(s, x, z);
  run(s, 0.05);
  const [a, b] = s.arsenal.shells;
  assert.equal(s.arsenal.shells.length, 2);
  assert.ok(Math.abs(a.toX - b.toX) > 8, "each shell takes a different group");
  assert.ok(Math.abs(a.impact - 4 * 0.6) < 1e-9);
  const pool = isolated();
  pool.upgrades.slag = 5;
  pool.specializations.slag = "slag_pool";
  const stats = slagStats(pool);
  assert.equal(stats.shells, 1);
  assert.ok(Math.abs(stats.radius - 1.2 * 1.25) < 1e-9);
  assert.ok(Math.abs(stats.duration - 2.8 * 1.3) < 1e-9);
  const e = enemy(pool, 4, 0, 1000);
  run(pool, 1.3);
  assert.ok((e.slowUntil ?? 0) > pool.time);
});

test("meltdown turns enemies killed by slag into new puddles without exceeding the cap", () => {
  const s = isolated();
  s.upgrades.slag = 5;
  s.upgrades.amplifier = 2;
  s.evolutions.meltdown = true;
  assert.equal(slagStats(s).shells, 3);
  for (let i = 0; i < 3; i++) enemy(s, 5 + i * 0.3, 0, 1);
  run(s, 0.75);
  assert.equal(s.kills, 3);
  assert.equal(s.arsenal.puddles.length, 4);
  const crowd = isolated();
  crowd.upgrades.slag = 5;
  crowd.evolutions.meltdown = true;
  for (let i = 0; i < 30; i++) enemy(crowd, 5 + (i % 6) * 0.2, Math.floor(i / 6) * 0.2, 1);
  run(crowd, 3);
  assert.ok(crowd.kills >= 20);
  assert.ok(crowd.arsenal.puddles.length <= ARSENAL_LIMITS.puddles);
});

test("capacitor bank shortens every weapon ability cooldown by 8% per rank, but not scrap launches", () => {
  const timers = (capacitor: number) => {
    const s = isolated();
    Object.assign(s.upgrades, { lightning: 1, burst: 1, turret: 1, harpoon: 1, slag: 1, capacitor });
    enemy(s, 2);
    enemy(s, 2.5, 0.3);
    run(s, 0.05);
    return [
      s.abilityTimers.lightning,
      s.abilityTimers.burst,
      s.abilityTimers.turret,
      s.arsenal.timers.harpoon,
      s.arsenal.timers.slag,
    ];
  };
  const base = timers(0),
    charged = timers(3);
  charged.forEach((value, i) => assert.ok(Math.abs(value - base[i] * 0.76) < 1e-9, `timer ${i}`));
  const s = isolated();
  s.upgrades.capacitor = 4;
  s.scrap = 4;
  s.cooldown = 0;
  assert.equal(launch(s), true);
  assert.equal(s.cooldown, 1.15);
});

test("field amplifier widens the burst, the scrap cyclone and slag puddles by 10% per rank", () => {
  const burst = (amplifier: number) => {
    const s = isolated();
    s.upgrades.burst = 1;
    s.upgrades.amplifier = amplifier;
    const e = enemy(s, 3.5);
    run(s, 0.05);
    return [e.hp, s.events.find((event) => event.kind === "burst")!.radius!];
  };
  const [untouched, plain] = burst(0);
  assert.equal(untouched, 100);
  assert.ok(Math.abs(plain - 3.2) < 1e-9);
  const [hp, radius] = burst(2);
  assert.equal(hp, 96);
  assert.ok(Math.abs(radius - 3.2 * 1.2) < 1e-9);
  const cyclone = (amplifier: number) => {
    const s = isolated();
    s.evolutions.vortex = true;
    s.upgrades.amplifier = amplifier;
    const e = enemy(s, 4);
    run(s, 0.05);
    return e.hp;
  };
  assert.equal(cyclone(0), 100, "outside the 3.8 m cyclone");
  assert.equal(cyclone(1), 92);
  const s = isolated();
  s.upgrades.slag = 1;
  s.upgrades.amplifier = 4;
  assert.ok(Math.abs(slagStats(s).radius - 1.4) < 1e-9);
});

test("pulse reactor echoes each blast with more reach and sweeps nearby pickups to the robot", () => {
  const s = isolated();
  s.upgrades.burst = 5;
  s.upgrades.capacitor = 2;
  s.evolutions.reactor = true;
  const edge = enemy(s, 5.5, 0, 100);
  s.pickups.push({ id: s.nextId++, x: -8, z: 0, kind: "xp", born: -1, value: 2 });
  run(s, 0.05);
  assert.equal(edge.hp, 100, "outside the first 4.8 m blast");
  assert.ok(Math.abs(s.abilityTimers.burst - 3.8 * 0.8 * 0.84) < 1e-9);
  run(s, 0.45);
  assert.equal(edge.hp, 100);
  run(s, 0.1);
  assert.equal(edge.hp, 88, "the 6.2 m echo hits 0.5 s later for full damage");
  run(s, 0.6);
  assert.equal(s.xp, 2, "the sweep pulled energy from 8 m");
});

test("new weapons branch at rank three and unlock their evolutions with the matching support", () => {
  for (const [weapon, support, evolution] of [
    ["harpoon", "magnet", "winch"],
    ["slag", "amplifier", "meltdown"],
    ["burst", "capacitor", "reactor"],
  ] as const) {
    const s = isolated();
    s.upgrades[weapon] = 2;
    s.phase = "upgrade";
    s.choices = [weapon];
    assert.equal(chooseUpgrade(s, weapon), true);
    assert.deepEqual(
      s.specializationChoices,
      (Object.keys(SPECIALIZATIONS) as SpecializationId[]).filter((id) => SPECIALIZATIONS[id].weapon === weapon),
    );
    const evolved = isolated();
    evolved.upgrades[weapon] = 4;
    evolved.upgrades[support] = 2;
    evolved.phase = "upgrade";
    evolved.choices = [weapon];
    chooseUpgrade(evolved, weapon);
    assert.equal(evolved.evolutions[evolution], true);
    assert.equal(evolved.evolutionNotice?.id, evolution);
  }
});

test("elite chance ramps from 3% at 4:00 to 10% at 12:00 plus stage and challenge bonuses", () => {
  const at = (time: number, config: RunConfig = DEFAULT_RUN_CONFIG) =>
    eliteChance({ time, config });
  assert.equal(at(239.9), 0);
  assert.ok(Math.abs(at(240) - 0.03) < 1e-9);
  assert.ok(Math.abs(at(480) - 0.065) < 1e-9);
  assert.ok(Math.abs(at(720) - 0.1) < 1e-9);
  assert.ok(Math.abs(at(900) - 0.1) < 1e-9);
  const night = { ...DEFAULT_RUN_CONFIG, stage: "night" as const, modifiers: { ...NO_MODIFIERS, eliteChance: 0.05 } };
  assert.ok(Math.abs(at(720, night) - 0.2) < 1e-9);
  assert.equal(at(100, night), 0);
});

test("elites never spawn or consume the seeded sequence before 4:00; later ones are tougher", () => {
  const spawnWave = (time: number, eliteBonus: number) => {
    const s = isolated({ ...DEFAULT_RUN_CONFIG, modifiers: { ...NO_MODIFIERS, eliteChance: eliteBonus } });
    s.time = time;
    for (let i = 0; i < 40; i++) {
      s.spawnTimer = 0;
      update(s, 0.001, still, { deferDiscovery: true });
    }
    return s;
  };
  const plain = spawnWave(100, 0),
    boosted = spawnWave(100, 1);
  assert.equal(boosted.enemies.filter((e) => e.elite).length, 0);
  assert.equal(boosted.rng, plain.rng);
  const late = spawnWave(800, 1);
  assert.ok(late.enemies.length > 20);
  const base: Record<string, number> = { can: 4, runner: 3, brute: 15, charger: 9, spitter: 7, warden: 12 };
  for (const e of late.enemies) {
    assert.equal(e.elite, true);
    const expected = base[e.type] * (1 + 800 / 180) * ELITE.health;
    assert.ok(Math.abs(e.hp / expected - 1) < 1e-3, `${e.type} ${e.hp}`);
  }
  const radiusOf = (elite: boolean) => enemyRadius({ id: 1, x: 0, z: 0, hp: 1, hit: 0, seed: 0, type: "brute", elite });
  assert.ok(Math.abs(radiusOf(true) - 0.65 * ELITE.radius) < 1e-9);
  assert.equal(radiusOf(false), 0.65);
});

test("an elite kill pays triple XP, extra scrap and a part, and is counted", () => {
  const drops = (elite: boolean) => {
    const s = isolated();
    const e = enemy(s, 3, 0, 1, "brute");
    e.elite = elite;
    s.shots.push({ id: s.nextId++, x: 3, z: 0, vx: 0, vz: 0, life: 1, kind: 0, damage: 5 });
    run(s, 0.05);
    const xp = s.pickups.filter((p) => p.kind === "xp");
    return {
      xp: xp.reduce((sum, p) => sum + (p.value ?? 1), 0),
      scrap: s.pickups.filter((p) => p.kind === "scrap").length,
      parts: s.earnedParts,
      elites: s.stats.eliteKills,
      event: s.events.find((event) => event.kind === "kill")?.elite ?? false,
    };
  };
  assert.deepEqual(drops(false), { xp: 4, scrap: 2, parts: 0, elites: 0, event: false });
  assert.deepEqual(drops(true), { xp: 12, scrap: ELITE.scrap, parts: 1, elites: 1, event: true });
});

test("new weapons and elite kills reuse existing sounds", () => {
  const at = { x: 0, z: 0 };
  assert.equal(eventCue({ kind: "harpoon", ...at }), "launch");
  assert.equal(eventCue({ kind: "slag", ...at }), "burst");
  assert.equal(eventCue({ kind: "kill", ...at, elite: true }), "reward");
  assert.equal(eventCue({ kind: "kill", ...at }), "kill");
  const s = isolated();
  s.upgrades.harpoon = 1;
  s.upgrades.slag = 1;
  enemy(s, 4);
  run(s, 0.7);
  assert.ok(s.events.some((e) => e.kind === "harpoon"));
  assert.ok(s.events.some((e) => e.kind === "slag"));
});

test("co-op runs the new weapons for both robots, shares their visuals and clears a downed robot's", () => {
  const session = new CoopSession([DEFAULT_RUN_CONFIG, DEFAULT_RUN_CONFIG], "arsenal");
  for (const p of session.players) {
    Object.assign(p.upgrades, { harpoon: 5, slag: 5, burst: 5, capacitor: 2, amplifier: 2 });
    p.evolutions.reactor = p.evolutions.meltdown = p.evolutions.winch = true;
    p.immunity = 1000;
    p.openingRemaining = 0;
  }
  session.players[0].player = { x: -3, z: 0 };
  session.players[1].player = { x: 3, z: 0 };
  let sawBoth = false;
  for (let tick = 0; tick < 900; tick++) {
    session.tick(1 / 30, [
      { x: Math.cos(tick / 40), z: Math.sin(tick / 40) },
      { x: -Math.cos(tick / 40), z: Math.sin(tick / 40) },
    ]);
    const snapshot = session.snapshot(0).state.arsenal;
    const own = session.players[0].arsenal,
      other = session.players[1].arsenal;
    assert.equal(snapshot.harpoons.length, own.harpoons.length + other.harpoons.length);
    assert.equal(snapshot.puddles.length, own.puddles.length + other.puddles.length);
    sawBoth ||= own.harpoons.length > 0 && other.harpoons.length > 0;
    for (const p of session.players)
      assert.ok(p.arsenal.puddles.length <= ARSENAL_LIMITS.puddles && p.arsenal.harpoons.length <= ARSENAL_LIMITS.harpoons);
    session.clearEvents();
  }
  assert.ok(sawBoth);
  assert.ok(session.players[0].kills > 0);
  JSON.parse(JSON.stringify(session.snapshot(1)));
  session.players[1].hp = 0;
  session.players[1].immunity = 0;
  session.tick(1 / 30, [still, still]);
  assert.deepEqual(
    [session.players[1].arsenal.harpoons, session.players[1].arsenal.shells, session.players[1].arsenal.puddles],
    [[], [], []],
  );
});

test("every language names and describes the new abilities and branches with real values", () => {
  const ids: UpgradeId[] = ["harpoon", "slag", "capacitor", "amplifier"];
  const branches: SpecializationId[] = ["harpoon_volley", "harpoon_anchor", "slag_cluster", "slag_pool"];
  const english = Object.fromEntries(branches.map((id) => [id, specializationCopy(id)]));
  const s = isolated();
  for (const { code } of LANGUAGES) {
    setLanguage(code);
    for (const id of ids)
      for (let rank = 0; rank < UPGRADES[id].maxRank; rank++) {
        s.upgrades[id] = rank;
        const text = localizedUpgradeDescription(s, id);
        assert.doesNotMatch(text, /undefined|NaN|\{\w+\}/, `${code} ${id} ${rank}`);
        assert.match(text, /\d/);
      }
    for (const id of branches) {
      const [name, description] = specializationCopy(id);
      assert.ok(name.length > 3 && description.length > 20);
      if (code !== "en") assert.notDeepEqual([name, description], english[id], `${code} ${id}`);
    }
    if (code !== "en") assert.notEqual(t("Scrap Winch"), "Scrap Winch");
  }
  setLanguage("de");
  Object.assign(s.upgrades, { harpoon: 0, capacitor: 0 });
  assert.equal(localizedUpgradeDescription(s, "harpoon"), "Wirft alle 2,3 s einen durchschlagenden Haken nach vorn: 6 Schaden hin und zurück.");
  setLanguage("en");
  assert.equal(localizedUpgradeDescription(s, "harpoon"), "Throw a piercing hook ahead every 2.3s for 6 damage, out and back.");
  s.upgrades.slag = 4;
  assert.equal(localizedUpgradeDescription(s, "slag"), "Impact damage 4.5 → 5; +1 shell; larger, longer puddles.");
});
