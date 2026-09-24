import { getObstacles } from "./world";
import { SPECIALIZATIONS, weaponBranches, type SpecializationId, type Specializations, type WeaponId } from "./specializations";
import { createDroneState, updateDrone, droneUpgradeDescription, DRONE_MAX_RANK, type DroneState, type DroneUpgradeId } from "./drone";
import {
  createEncounterState,
  updateEncounters,
  updateEnemyBehavior,
  onEncounterKill,
  FINAL_BOSS,
  type EncounterHooks,
} from "./encounters";
import { createDiscoveryState, updateDiscovery } from "./discovery";
import { DEFAULT_RUN_CONFIG, type RunConfig } from "./progression";
import {
  bannedUpgrades,
  enemyHealthScale,
  enemySpeedScale,
  spawnRateScale,
} from "./stage-rules";
import {
  createEvolutions,
  unlockEvolutions,
  type EvolutionId,
} from "./evolution-core";

export type Vec = { x: number; z: number };
export type UpgradeId =
  | "saw"
  | "lightning"
  | "turret"
  | "burst"
  | "boots"
  | "magnet"
  | "armor"
  | DroneUpgradeId
  | "repair"
  | "refill"
  | "overclock";
export type Enemy = Vec & {
  id: number;
  hp: number;
  hit: number;
  seed: number;
  /** The stage's last boss; defeating it clears the stage. */
  final?: boolean;
  /** Guard shots halve movement until this simulation timestamp. */
  slowUntil?: number;
  /** Tougher, glowing variant of an ordinary enemy with better drops. */
  elite?: boolean;
  type:
    | "can"
    | "runner"
    | "brute"
    | "charger"
    | "spitter"
    | "warden"
    | "miniboss"
    | "boss";
};
export type Pickup = Vec & {
  id: number;
  kind: "scrap" | "xp";
  born: number;
  value?: number;
};
export type Shot = Vec & {
  id: number;
  vx: number;
  vz: number;
  life: number;
  kind: number;
  damage?: number;
  pierce?: number;
  hitIds?: number[];
};
export type Turret = Vec & {
  id: number;
  life: number;
  fireTimer: number;
  rank: number;
};
export type GameEvent = Vec & {
  kind:
    | "hit"
    | "kill"
    | "collect"
    | "launch"
    | "hurt"
    | "pulse"
    | "lightning"
    | "burst"
    | "turret";
  pickupKind?: "scrap" | "xp";
  fromX?: number;
  fromZ?: number;
  radius?: number;
};
/** Per-run counters for results, work orders and analytics. */
export type RunStats = {
  bossKills: number;
  minibossKills: number;
  eliteKills: number;
  revivesUsed: number;
  rerollsUsed: number;
  banishesUsed: number;
};
export type State = {
  config: RunConfig;
  drone: DroneState;
  specializations: Specializations;
  specializationChoices: SpecializationId[];
  earnedParts: number;
  encounters: ReturnType<typeof createEncounterState>;
  discovery: ReturnType<typeof createDiscoveryState>;
  evolutions: Record<EvolutionId, boolean>;
  evolutionNotice: { id: EvolutionId; until: number } | null;
  vortexTimer: number;
  time: number;
  /** Non-blocking pickup/guide animation timer; never gates combat. */
  openingRemaining: number;
  player: Vec;
  aim: Vec;
  facing: Vec;
  hp: number;
  scrap: number;
  xp: number;
  /** XP multiplier remainder, banked once it adds up to a whole point. */
  xpFraction: number;
  level: number;
  xpNeeded: number;
  choices: UpgradeId[];
  upgrades: Record<UpgradeId, number>;
  /** Level-up redraws left this run. */
  rerolls: number;
  /** Level-up removals left this run. */
  banishes: number;
  /** Removed from every later level-up pool this run. */
  banished: UpgradeId[];
  /** Automatic revives left this run. */
  revives: number;
  stats: RunStats;
  kills: number;
  spawned: number;
  wave: number;
  cooldown: number;
  immunity: number;
  /** "won" means the stage was cleared; like "lost", the run is over. */
  phase: "ready" | "playing" | "paused" | "upgrade" | "lost" | "won";
  enemies: Enemy[];
  pickups: Pickup[];
  shots: Shot[];
  turrets: Turret[];
  events: GameEvent[];
  spawnTimer: number;
  pulseTimer: number;
  abilityTimers: { lightning: number; turret: number; burst: number };
  nextId: number;
  rng: number;
  launched: number;
  overclockTimer: number;
};
export const OPENING_DURATION = 3;
export const MAX_SCRAP = 12;
export const ORBIT_RADIUS = 1.85;
export const ENTITY_LIMITS = {
  enemies: 140,
  pickups: 320,
  shots: 192,
  turrets: 6,
  events: 160,
};
export const UPGRADES: Record<
  UpgradeId,
  { name: string; description: string; maxRank: number }
> = {
  saw: {
    name: "Orbiting Saws",
    description: "Sharper, wider, faster scrap blades.",
    maxRank: 5,
  },
  lightning: {
    name: "Chain Lightning",
    description: "Electric arcs jump between nearby enemies.",
    maxRank: 5,
  },
  turret: {
    name: "Scrap Turret",
    description: "Deploy a turret that fires at nearby enemies.",
    maxRank: 5,
  },
  burst: {
    name: "Magnetic Burst",
    description: "A magnetic shockwave damages and pushes enemies away.",
    maxRank: 5,
  },
  boots: {
    name: "Turbo Treads",
    description: "Move faster through the scrapyard.",
    maxRank: 4,
  },
  magnet: {
    name: "Pickup Magnet",
    description: "Pull energy and scrap from farther away.",
    maxRank: 4,
  },
  armor: {
    name: "Steel Plating",
    description: "Reduce damage from enemy contact.",
    maxRank: 4,
  },
  drone_collector: {
    name: "Collector Drone",
    description: "Improve Collector range and retrieval speed. Rank 3 pulls up to 5 pickups every 6 seconds.",
    maxRank: DRONE_MAX_RANK,
  },
  drone_repair: {
    name: "Repair Drone",
    description: "Improve Repair healing and cooldown. Rank 3 stores one emergency heal per run.",
    maxRank: DRONE_MAX_RANK,
  },
  drone_guard: {
    name: "Guard Drone",
    description: "Improve Guard damage and fire rate. Rank 3 shots slow enemies by 50% for 1 second.",
    maxRank: DRONE_MAX_RANK,
  },
  refill: {
    name: "Scrap Delivery",
    description:
      "Refill all orbiting scrap and reset launch cooldown. Repeatable.",
    maxRank: Infinity,
  },
  overclock: {
    name: "Overclock",
    description: "+25% damage and +15% speed for 20 seconds. Repeatable.",
    maxRank: Infinity,
  },
  repair: {
    name: "Field Repair",
    description: "Restore 35 health immediately. Repeatable.",
    maxRank: Infinity,
  },
};
/** Repeatable level-up supplies: they fill short pools and cannot be banished. */
export const SUPPLIES: readonly UpgradeId[] = ["repair", "refill", "overclock"];
export function upgradeDescription(s: State, id: UpgradeId): string {
  const rank = s.upgrades[id],
    next = rank + 1;
  switch (id) {
    case "drone_collector":
      return droneUpgradeDescription("collector", rank);
    case "drone_repair":
      return droneUpgradeDescription("repair", rank);
    case "drone_guard":
      return droneUpgradeDescription("guard", rank);
    case "saw":
      return `${2 + rank - 1} → ${2 + next - 1} blade damage; wider and faster orbit.`;
    case "lightning":
      return rank
        ? `${rank + 1} → ${next + 1} chained targets; more damage.`
        : "Zap 2 enemies every 2.8 seconds for 4 damage each.";
    case "turret":
      return rank
        ? `Turret damage ${2 + rank} → ${2 + next}; faster fire and longer life.`
        : "Deploy a turret every 8 seconds. Fires for 3 damage.";
    case "burst":
      return rank
        ? `Blast damage ${2 + rank * 2} → ${2 + next * 2}; larger radius and shorter cooldown.`
        : "Blast and push back nearby enemies every 5 seconds.";
    case "boots":
      return `Movement speed +12% (total +${next * 12}%).`;
    case "magnet":
      return `Pickup radius ${Number((3.2 + rank * 0.9).toFixed(1))} → ${Number((3.2 + next * 0.9).toFixed(1))} m.`;
    case "armor":
      return `Reduce every contact hit by ${next * 2} damage.`;
    case "refill":
      return "Restore all 12 orbiting scrap pieces and reset launch cooldown.";
    case "overclock":
      return "+25% damage and +15% movement speed for 20 seconds. Refreshes duration.";
    case "repair":
      return `Restore 35 health now (${Math.ceil(s.hp)} → ${Math.min(100, Math.ceil(s.hp) + 35)}).`;
  }
}
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
function random(s: State) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function emit(s: State, event: GameEvent) {
  if (s.events.length < ENTITY_LIMITS.events) s.events.push(event);
}
function resolveObstacles(p: Vec, radius: number) {
  // A second pass handles touching obstacle corners without allowing diagonal clipping.
  const obstacles = getObstacles(p.x, p.z);
  for (let pass = 0; pass < 2; pass++)
    for (const o of obstacles) {
      const dx = p.x - o.x,
        dz = p.z - o.z,
        d = Math.hypot(dx, dz),
        required = radius + o.radius;
      if (d < required) {
        p.x += (d ? dx / d : 1) * (required - d);
        p.z += (d ? dz / d : 0) * (required - d);
      }
    }
}
export function createState(config: RunConfig = DEFAULT_RUN_CONFIG): State {
  const s: State = {
    config: { ...config },
    drone: createDroneState(),
    specializations: {},
    specializationChoices: [],
    earnedParts: 0,
    encounters: createEncounterState(),
    discovery: createDiscoveryState(),
    evolutions: createEvolutions(),
    evolutionNotice: null,
    vortexTimer: 0,
    time: 0,
    openingRemaining: OPENING_DURATION,
    player: { x: 0, z: 0 },
    aim: { x: 0, z: 1 },
    facing: { x: 0, z: 1 },
    hp: 100,
    scrap: Math.min(MAX_SCRAP, Math.max(0, Math.floor(config.startingScrap || 0))),
    xp: 0,
    xpFraction: 0,
    level: 1,
    xpNeeded: 5,
    choices: [],
    upgrades: {
      saw: config.startingWeapon === "saw" ? 1 : 0,
      lightning: config.startingWeapon === "lightning" ? 1 : 0,
      turret: config.startingWeapon === "turret" ? 1 : 0,
      burst: config.startingWeapon === "burst" ? 1 : 0,
      boots: 0,
      magnet: 0,
      armor: 0,
      drone_collector: 0,
      drone_repair: 0,
      drone_guard: 0,
      repair: 0,
      refill: 0,
      overclock: 0,
    },
    rerolls: config.rerolls,
    banishes: config.banishes,
    banished: [],
    revives: config.revives,
    stats: {
      bossKills: 0,
      minibossKills: 0,
      eliteKills: 0,
      revivesUsed: 0,
      rerollsUsed: 0,
      banishesUsed: 0,
    },
    kills: 0,
    spawned: 0,
    wave: 1,
    cooldown: 0,
    immunity: 0,
    phase: "ready",
    enemies: [],
    pickups: [],
    shots: [],
    turrets: [],
    events: [],
    spawnTimer: 1.3,
    pulseTimer: 1,
    abilityTimers: { lightning: 0, turret: 0, burst: 0 },
    nextId: 1,
    rng: Number.isFinite(config.seed) ? config.seed >>> 0 : 41,
    launched: 0,
    overclockTimer: 0,
  };
  // Challenge ranks stack on the starting weapon; repeatable supplies are not build ranks.
  for (const [id, ranks] of Object.entries(config.modifiers?.startingUpgrades ?? {}) as [UpgradeId, number][])
    if (Object.hasOwn(UPGRADES, id) && !SUPPLIES.includes(id) && Number.isFinite(ranks) && ranks > 0)
      s.upgrades[id] = Math.min(UPGRADES[id].maxRank, s.upgrades[id] + Math.floor(ranks));
  // Real ground scrap is gathered before combat, so the first ammunition has a visible source.
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    s.pickups.push({
      id: s.nextId++,
      x: Math.cos(angle) * 2.4,
      z: Math.sin(angle) * 2.4,
      kind: "scrap",
      born: 0,
    });
  }
  for (let i = 0; i < 7; i++)
    spawn(s, (i * Math.PI * 2) / 7, 8 + random(s) * 2);
  return s;
}
function spawn(
  s: State,
  angle = random(s) * Math.PI * 2,
  radius = 23 + random(s) * 3,
  center: Vec = s.player,
) {
  if (s.enemies.length >= ENTITY_LIMITS.enemies) return;
  const roll = random(s);
  const type: Enemy["type"] =
    s.time >= 120 && roll < 0.12
      ? "warden"
      : s.time >= 60 && roll < 0.25
        ? "spitter"
        : s.time >= 35 && roll < 0.38
          ? "charger"
          : s.time >= 75 && roll < 0.5
            ? "brute"
            : s.time >= 30 && roll < 0.65
              ? "runner"
              : "can";
  const e: Enemy = {
    id: s.nextId++,
    x: center.x + Math.cos(angle) * radius,
    z: center.z + Math.sin(angle) * radius,
    hp:
      (type === "brute"
        ? 15
        : type === "warden"
          ? 12
          : type === "spitter"
            ? 7
            : type === "charger"
              ? 9
              : type === "runner"
                ? 3
                : 4) *
      (1 + s.time / 180) *
      enemyHealthScale(s.config),
    hit: 0,
    seed: random(s) * 10,
    type,
  };
  resolveObstacles(e, type === "brute" ? 0.65 : 0.35);
  s.enemies.push(e);
  s.spawned++;
}
/**
 * Level-up candidates: unmaxed permanent upgrades the run allows, repair when hurt, then
 * supplies until there are three. `exclude` lets a redraw avoid the cards on screen.
 */
function upgradePool(s: State, exclude: readonly UpgradeId[] = []) {
  const banned = bannedUpgrades(s.config);
  const allowed = (id: UpgradeId) =>
    !exclude.includes(id) && !s.banished.includes(id) && !banned.includes(id);
  const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter(
    (id) =>
      !SUPPLIES.includes(id) &&
      s.upgrades[id] < UPGRADES[id].maxRank &&
      allowed(id),
  );
  if (s.hp < 80 && allowed("repair")) pool.push("repair");
  for (const fallback of SUPPLIES)
    if (pool.length < 3 && !pool.includes(fallback) && allowed(fallback))
      pool.push(fallback);
  return pool;
}
function shuffle(s: State, pool: UpgradeId[]) {
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}
export function offerUpgrade(s: State) {
  if (s.choices.length || s.specializationChoices.length || s.hp <= 0 || s.xp < s.xpNeeded) return;
  s.xp -= s.xpNeeded;
  s.level++;
  s.xpNeeded = 5 + (s.level - 1) * 4;
  const pool = upgradePool(s);
  // Only a challenge that bans every supply can empty the pool; never leave the sheet blank.
  s.choices = shuffle(s, pool.length ? pool : [...SUPPLIES]).slice(0, 3);
  s.phase = "upgrade";
}
const toolsOpen = (s: State) =>
  s.phase === "upgrade" && !s.specializationChoices.length && s.choices.length > 0;
/** Supplies are the fallback that keeps level-ups full, so only build upgrades can be banished. */
export const canBanish = (id: UpgradeId) => !SUPPLIES.includes(id);
/** Redraws every level-up card, avoiding the current ones while the pool allows it. */
export function rerollChoices(s: State): boolean {
  if (!toolsOpen(s) || s.rerolls <= 0) return false;
  // Fresh cards (supplies included) come first; the current ones only fill what is left.
  const fresh = shuffle(s, upgradePool(s, s.choices));
  s.choices = [...fresh, ...shuffle(s, [...s.choices])].slice(0, 3);
  s.rerolls--;
  s.stats.rerollsUsed++;
  return true;
}
/** Removes an offered build upgrade from every later pool this run and refills its card. */
export function banishChoice(s: State, id: UpgradeId): boolean {
  const slot = s.choices.indexOf(id);
  if (!toolsOpen(s) || s.banishes <= 0 || slot < 0 || !canBanish(id)) return false;
  s.banishes--;
  s.stats.banishesUsed++;
  s.banished.push(id);
  const replacement = shuffle(s, upgradePool(s, s.choices))[0];
  s.choices = replacement
    ? s.choices.map((choice, i) => (i === slot ? replacement : choice))
    : s.choices.filter((choice) => choice !== id);
  if (!s.choices.length) s.choices = ["refill"];
  return true;
}
export function chooseUpgrade(s: State, id: UpgradeId): boolean {
  if (
    s.phase !== "upgrade" ||
    s.specializationChoices.length > 0 ||
    !s.choices.includes(id) ||
    s.upgrades[id] >= UPGRADES[id].maxRank
  )
    return false;
  s.upgrades[id]++;
  if (id === "refill") {
    s.scrap = MAX_SCRAP;
    s.cooldown = 0;
  }
  if (id === "overclock") s.overclockTimer = 20;
  if (id === "repair") s.hp = Math.min(100, s.hp + 35);
  if (id === "saw") s.scrap = Math.min(MAX_SCRAP, s.scrap + 2);
  if (id === "lightning" || id === "turret" || id === "burst")
    s.abilityTimers[id] = 0;
  for (const evolved of unlockEvolutions(s.upgrades, s.evolutions))
    s.evolutionNotice = { id: evolved, until: s.time + 4 };
  s.choices = [];
  const branches = weaponBranches(id);
  if (s.upgrades[id] >= 3 && branches.length && !s.specializations[id as WeaponId]) {
    s.specializationChoices = branches;
    return true;
  }
  s.phase = "playing";
  offerUpgrade(s);
  return true;
}
export function chooseSpecialization(s: State, id: SpecializationId): boolean {
  if (s.phase !== "upgrade" || !s.specializationChoices.includes(id)) return false;
  const weapon = SPECIALIZATIONS[id].weapon;
  if (s.specializations[weapon] || s.upgrades[weapon] < 3) return false;
  s.specializations[weapon] = id;
  s.specializationChoices = [];
  s.phase = "playing";
  offerUpgrade(s);
  return true;
}
export function orbitPosition(
  s: Pick<State, "time" | "upgrades" | "scrap" | "player"> & Partial<Pick<State, "specializations">>,
  index: number,
): Vec {
  const rank = Math.max(0, s.upgrades.saw - 1);
  const a =
      s.time * (2.3 + rank * 0.25) +
      (index * Math.PI * 2) / Math.max(1, s.scrap),
    radius = ORBIT_RADIUS + rank * 0.12 + (s.specializations?.saw === "saw_reaper" ? 0.6 : 0);
  return {
    x: s.player.x + Math.cos(a) * radius,
    z: s.player.z + Math.sin(a) * radius,
  };
}
export function launch(s: State, target?: Vec): boolean {
  if (
    s.phase !== "playing" ||
    s.cooldown > 0 ||
    !s.scrap ||
    s.shots.length >= ENTITY_LIMITS.shots
  )
    return false;
  const base = Math.atan2(s.aim.z, s.aim.x),
    count = s.scrap;
  for (let i = 0; i < count && s.shots.length < ENTITY_LIMITS.shots; i++) {
    const origin = orbitPosition(s, i);
    const a = target
      ? Math.atan2(target.z - origin.z, target.x - origin.x)
      : base + (i - (count - 1) / 2) * 0.075;
    s.shots.push({
      id: s.nextId++,
      ...origin,
      vx: Math.cos(a) * 17,
      vz: Math.sin(a) * 17,
      life: 1.6,
      kind: i % 3,
      damage: (4 + s.upgrades.saw) * (s.specializations.saw === "saw_rail" ? 1.5 : s.specializations.saw === "saw_reaper" ? 0.75 : 1),
      pierce: s.specializations.saw === "saw_rail" ? 2 : 0,
      hitIds: [],
    });
  }
  s.scrap = 0;
  s.cooldown = 1.15;
  s.launched++;
  emit(s, { kind: "launch", ...s.player });
  return true;
}
function addPickup(s: State, p: Pickup) {
  if (s.pickups.length < ENTITY_LIMITS.pickups) {
    s.pickups.push(p);
    return;
  }
  // Preserve the entire value even after long runs. Merge into the nearest same-kind pile.
  let nearest: Pickup | undefined,
    best = Infinity;
  for (const existing of s.pickups)
    if (existing.kind === p.kind) {
      const d = distance(existing, p);
      if (d < best) {
        best = d;
        nearest = existing;
      }
    }
  if (nearest && best <= 4) {
    nearest.value = (nearest.value ?? 1) + (p.value ?? 1);
    return;
  }
  // New kills must leave reachable drops, even when a trail of old gems fills
  // the pool. Coalesce an old same-kind pair in place to free a local slot.
  let anchor =
    s.pickups.find((existing) => distance(existing, s.player) > 10) ??
    s.pickups[0];
  let partnerIndex = -1,
    partnerDistance = Infinity;
  function findPartner() {
    partnerIndex = -1;
    partnerDistance = Infinity;
    for (let i = 0; i < s.pickups.length; i++) {
      const existing = s.pickups[i];
      if (existing === anchor || existing.kind !== anchor.kind) continue;
      const d = distance(existing, anchor);
      if (d < partnerDistance) {
        partnerDistance = d;
        partnerIndex = i;
      }
    }
  }
  findPartner();
  if (partnerIndex < 0) {
    // A lone pile of one kind means the other kind has ample partners.
    anchor = s.pickups.find((existing) => existing.kind !== anchor.kind)!;
    findPartner();
  }
  const partner = s.pickups[partnerIndex];
  anchor.value = (anchor.value ?? 1) + (partner.value ?? 1);
  s.pickups[partnerIndex] = p;
}
function hurt(s: State, e: Enemy, damage: number) {
  if (e.hp <= 0) return;
  e.hp -=
    damage * s.config.damageMultiplier * (s.overclockTimer > 0 ? 1.25 : 1);
  e.hit = 0.24;
  emit(s, { kind: "hit", x: e.x, z: e.z });
  if (e.hp > 0) return;
  s.kills++;
  emit(s, { kind: "kill", x: e.x, z: e.z });
  onEncounterKill(s, e, encounterHooks(s));
  addPickup(s, {
    id: s.nextId++,
    x: e.x,
    z: e.z,
    kind: "xp",
    born: s.time,
    value: e.type === "brute" ? 4 : 1,
  });
  for (let i = 0; i < 2; i++)
    addPickup(s, {
      id: s.nextId++,
      x: e.x + (random(s) - 0.5) * 0.6,
      z: e.z + (random(s) - 0.5) * 0.6,
      kind: "scrap",
      born: s.time,
    });
}
function nearestEnemy(s: State, p: Vec, range: number, excluded?: Set<number>) {
  let target: Enemy | undefined,
    best = range;
  for (const e of s.enemies)
    if (e.hp > 0 && !excluded?.has(e.id)) {
      const d = distance(e, p);
      if (d < best) {
        best = d;
        target = e;
      }
    }
  return target;
}
function abilities(s: State, dt: number) {
  for (const id of ["lightning", "turret", "burst"] as const)
    s.abilityTimers[id] -= dt;
  const lightning = s.upgrades.lightning;
  if (lightning && s.abilityTimers.lightning <= 0) {
    let origin = s.player;
    const hit = new Set<number>();
    const chain = s.specializations.lightning === "lightning_chain";
    const focus = s.specializations.lightning === "lightning_focus";
    const targets = focus ? 1 : lightning + 1 + (s.evolutions.storm ? 4 : 0) + (chain ? 3 : 0);
    for (let i = 0; i < targets; i++) {
      const e = nearestEnemy(
        s,
        origin,
        i ? (chain ? 6 : s.evolutions.storm ? 5.5 : 3.8) : s.evolutions.storm ? 9 : 6,
        hit,
      );
      if (!e) break;
      emit(s, {
        kind: "lightning",
        x: e.x,
        z: e.z,
        fromX: origin.x,
        fromZ: origin.z,
      });
      hit.add(e.id);
      hurt(s, e, (2 + lightning * 2) * (focus ? 3 : chain ? 0.75 : 1));
      origin = e;
    }
    s.abilityTimers.lightning =
      (3 - lightning * 0.2) * (s.evolutions.storm ? 0.5 : 1);
  }
  const burst = s.upgrades.burst;
  if (burst && s.abilityTimers.burst <= 0) {
    const wave = s.specializations.burst === "burst_wave";
    const crush = s.specializations.burst === "burst_crush";
    const radius = (2.8 + burst * 0.4) * (wave ? 1.5 : crush ? 0.75 : 1);
    const knockback = wave ? 3 : crush ? 0.5 : 1.5;
    emit(s, { kind: "burst", ...s.player, radius });
    for (const e of s.enemies) {
      const d = distance(s.player, e);
      if (d < radius && e.hp > 0) {
        hurt(s, e, (2 + burst * 2) * (crush ? 2.2 : wave ? 0.75 : 1));
        e.x += ((e.x - s.player.x) / (d || 1)) * knockback;
        e.z += ((e.z - s.player.z) / (d || 1)) * knockback;
        resolveObstacles(e, enemyRadius(e));
      }
    }
    s.abilityTimers.burst = 5.3 - burst * 0.3;
  }
  const rank = s.upgrades.turret;
  if (
    rank &&
    s.abilityTimers.turret <= 0 &&
    s.turrets.length < ENTITY_LIMITS.turrets
  ) {
    s.turrets.push({
      id: s.nextId++,
      ...s.player,
      life: 8 + rank * 2 + (s.evolutions.fortress ? 8 : 0),
      fireTimer: 0,
      rank,
    });
    s.abilityTimers.turret = 8;
  }
  const rapid = s.specializations.turret === "turret_rapid";
  const sniper = s.specializations.turret === "turret_sniper";
  for (const t of s.turrets) {
    t.life -= dt;
    t.fireTimer -= dt;
    if (t.fireTimer <= 0) {
      const e = nearestEnemy(s, t, sniper ? 14 : 8);
      if (e && s.shots.length < ENTITY_LIMITS.shots) {
        const d = distance(e, t) || 1;
        emit(s, { kind: "turret", x: t.x, z: t.z });
        s.shots.push({
          id: s.nextId++,
          x: t.x,
          z: t.z,
          vx: ((e.x - t.x) / d) * (sniper ? 20 : 14),
          vz: ((e.z - t.z) / d) * (sniper ? 20 : 14),
          life: 0.9,
          kind: 1,
          damage: (2 + t.rank + (s.evolutions.fortress ? 6 : 0)) * (sniper ? 2 : rapid ? 0.7 : 1),
          pierce: (s.evolutions.fortress ? 2 : 0) + (sniper ? 1 : 0),
          hitIds: [],
        });
      }
      t.fireTimer = (0.9 - t.rank * 0.1) * (s.evolutions.fortress ? 0.7 : 1) * (rapid ? 0.6 : sniper ? 1.6 : 1);
    }
  }
  s.turrets = s.turrets.filter((t) => t.life > 0);
}
/** Applies the run's XP multiplier; fractions carry over so the displayed XP stays whole. */
function gainXp(s: State, amount: number) {
  const multiplier = s.config.xpMultiplier > 0 ? s.config.xpMultiplier : 1;
  const total = amount * multiplier + (s.xpFraction || 0);
  const whole = Math.floor(total + 1e-9);
  s.xp += whole;
  s.xpFraction = Math.max(0, total - whole);
}
function collectPickups(s: State, dt: number, players: State[] = [s]) {
  // Keep the first scraps still briefly; then pull them slowly enough to read the magnet effect.
  if (s.openingRemaining > OPENING_DURATION - 0.7) return;
  s.pickups = s.pickups.filter((p) => {
    const collector = players
      .filter((a) => a.hp > 0 && (p.kind === "xp" || a.scrap < MAX_SCRAP))
      .reduce<
        State | undefined
      >((best, a) => (!best || distance(a.player, p) < distance(best.player, p) ? a : best), undefined);
    if (collector !== s) return true;
    const d = distance(p, s.player),
      canCollect = p.kind === "xp" || s.scrap < MAX_SCRAP;
    if (
      canCollect &&
      d < 3.2 + s.upgrades.magnet * 0.9 + s.config.pickupBonus &&
      s.time - p.born > 0.15
    ) {
      const step = Math.min(
        d,
        dt * (s.openingRemaining > 0 ? 2.8 + 2 / (d + 0.4) : 7 + 8 / (d + 0.4)),
      );
      p.x += ((s.player.x - p.x) / (d || 1)) * step;
      p.z += ((s.player.z - p.z) / (d || 1)) * step;
    }
    if (canCollect && distance(p, s.player) < 0.5) {
      const value = p.value ?? 1;
      if (p.kind === "scrap") {
        const take = Math.min(value, MAX_SCRAP - s.scrap);
        s.scrap += take;
        p.value = value - take;
      } else {
        gainXp(s, value);
        p.value = 0;
      }
      emit(s, { kind: "collect", pickupKind: p.kind, x: p.x, z: p.z });
      return !!p.value;
    }
    return true;
  });
}
export type UpdateOptions = {
  world?: boolean;
  players?: State[];
  deferUpgrade?: boolean;
  deferDiscovery?: boolean;
  spawnMultiplier?: number;
};
export function update(
  s: State,
  dt: number,
  movement: Vec,
  options: UpdateOptions = {},
) {
  const players = options.players ?? [s];
  const world = options.world !== false;
  if (s.phase !== "playing") return;
  dt = Math.min(0.05, Math.max(0, dt));
  if (!dt) return;
  s.time += dt;
  s.overclockTimer = Math.max(0, s.overclockTimer - dt);
  s.wave = 1 + Math.floor(s.time / 30);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.immunity = Math.max(0, s.immunity - dt);
  const len = Math.hypot(movement.x, movement.z);
  if (len > 0) {
    s.facing = { x: movement.x / len, z: movement.z / len };
    const speed =
      6.2 *
      s.config.speedMultiplier *
      (1 + s.upgrades.boots * 0.12) *
      (s.overclockTimer > 0 ? 1.15 : 1);
    s.player.x += (movement.x / Math.max(1, len)) * speed * dt;
    s.player.z += (movement.z / Math.max(1, len)) * speed * dt;
    resolveObstacles(s.player, 0.4);
  }
  if (s.openingRemaining > 0) {
    s.openingRemaining = Math.max(0, s.openingRemaining - dt);
    if (s.openingRemaining < 1e-8) s.openingRemaining = 0;
  }
  const encounter = encounterHooks(s);
  if (world) updateEncounters(s, dt, encounter, players);
  if (!survive(s)) return;
  if (world) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      const alive = players.filter((a) => a.hp > 0);
      for (let i = 0; i < Math.min(5, 1 + Math.floor(s.time / 60)); i++)
        spawn(
          s,
          undefined,
          undefined,
          alive[s.spawned % alive.length]?.player ?? s.player,
        );
      s.spawnTimer =
        Math.max(0.22, 1.35 / (1 + s.time / 80)) /
        ((options.spawnMultiplier ?? 1) * spawnRateScale(s.config));
    }
  }
  const enemySpeed = enemySpeedScale(s.config);
  // Local buckets bound separation work in a dense horde.
  const buckets = new Map<string, Enemy[]>();
  for (const e of s.enemies) {
    const key = `${Math.floor(e.x / 1.5)},${Math.floor(e.z / 1.5)}`;
    const group = buckets.get(key) ?? [];
    group.push(e);
    buckets.set(key, group);
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    if (world) {
      const target = players
        .filter((a) => a.hp > 0)
        .reduce(
          (best, a) =>
            distance(a.player, e) < distance(best.player, e) ? a : best,
          s,
        );
      e.hit = Math.max(0, e.hit - dt);
      let d = distance(e, target.player);
      if (d > 42) {
        s.encounters.brains.delete(e.id);
        s.encounters.warnings = s.encounters.warnings.filter(
          (w) => w.owner !== e.id,
        );
        const a = random(s) * Math.PI * 2;
        e.x = target.player.x + Math.cos(a) * 26;
        e.z = target.player.z + Math.sin(a) * 26;
        d = 26;
      }
      const customMovement = updateEnemyBehavior(
        target,
        e,
        dt,
        encounterHooks(target),
      );
      if (!survive(s)) return;
      const speed =
        (e.type === "runner" ? 2.5 : e.type === "brute" ? 0.95 : 1.25) *
        (1 + Math.min(0.85, s.time / 600)) * ((e.slowUntil ?? 0) > s.time ? 0.5 : 1) *
        enemySpeed;
      if (!customMovement && d > 0.01) {
        e.x += ((target.player.x - e.x) / d) * speed * dt;
        e.z += ((target.player.z - e.z) / d) * speed * dt;
      }
      const cx = Math.floor(e.x / 1.5),
        cz = Math.floor(e.z / 1.5);
      for (let x = cx - 1; x <= cx + 1; x++)
        for (let z = cz - 1; z <= cz + 1; z++)
          for (const other of buckets.get(`${x},${z}`) ?? []) {
            if (other.id <= e.id || other.hp <= 0) continue;
            const dx = e.x - other.x,
              dz = e.z - other.z,
              ed = Math.hypot(dx, dz),
              spacing = enemyRadius(e) + enemyRadius(other);
            if (ed < spacing && ed > 0) {
              const push = (spacing - ed) * 0.5;
              e.x += (dx / ed) * push;
              e.z += (dz / ed) * push;
              other.x -= (dx / ed) * push;
              other.z -= (dz / ed) * push;
            }
          }
      resolveObstacles(e, enemyRadius(e));
    }
    if (distance(e, s.player) < enemyRadius(e) + 0.3 && !s.immunity) {
      damagePlayer(
        s,
        (e.type === "boss"
          ? 24
          : e.type === "miniboss" || e.type === "brute"
            ? 18
            : 9) + Math.floor(s.time / 90),
      );
    }
    if (!survive(s)) return;
    if (!e.hit)
      for (let i = 0; i < s.scrap; i++)
        if (distance(e, orbitPosition(s, i)) < enemyRadius(e) + 0.25) {
          hurt(s, e, (1 + s.upgrades.saw) * (s.specializations.saw === "saw_reaper" ? 1.5 : s.specializations.saw === "saw_rail" ? 0.65 : 1));
          break;
        }
  }
  if (!survive(s)) return;
  s.pulseTimer -= dt;
  if (s.pulseTimer <= 0) {
    s.pulseTimer = s.scrap ? 1.8 : 0.65;
    const target = nearestEnemy(s, s.player, 3.3);
    if (target) {
      hurt(s, target, 2);
      emit(s, {
        kind: "pulse",
        x: target.x,
        z: target.z,
        fromX: s.player.x,
        fromZ: s.player.z,
      });
    }
  }
  abilities(s, dt);
  s.vortexTimer -= dt;
  if (s.evolutions.vortex && s.vortexTimer <= 0) {
    s.vortexTimer = 0.6;
    emit(s, { kind: "burst", ...s.player, radius: 3.8 });
    for (const enemy of s.enemies) {
      const d = distance(enemy, s.player);
      if (d < 3.8 && enemy.hp > 0) {
        hurt(s, enemy, 8);
        if (d > 1.3) {
          enemy.x += ((s.player.x - enemy.x) / (d || 1)) * 0.5;
          enemy.z += ((s.player.z - enemy.z) / (d || 1)) * 0.5;
          resolveObstacles(enemy, enemyRadius(enemy));
        }
      }
    }
  }
  // Only spend ammunition on a living target within combat range.
  const target = nearestEnemy(s, s.player, 8);
  if (target && s.scrap > 0 && s.cooldown === 0) {
    const d = distance(target, s.player) || 1;
    s.aim = { x: (target.x - s.player.x) / d, z: (target.z - s.player.z) / d };
    launch(s, target);
  }
  for (const shot of s.shots) {
    const oldX = shot.x,
      oldZ = shot.z;
    shot.x += shot.vx * dt;
    shot.z += shot.vz * dt;
    shot.life -= dt;
    for (const e of s.enemies)
      if (e.hp > 0 && shot.life > 0 && !shot.hitIds?.includes(e.id)) {
        const dx = shot.x - oldX,
          dz = shot.z - oldZ,
          t = Math.max(
            0,
            Math.min(
              1,
              ((e.x - oldX) * dx + (e.z - oldZ) * dz) /
                (dx * dx + dz * dz || 1),
            ),
          );
        if (
          Math.hypot(e.x - (oldX + t * dx), e.z - (oldZ + t * dz)) <
          enemyRadius(e) + 0.17
        ) {
          hurt(s, e, shot.damage ?? 5);
          (shot.hitIds ??= []).push(e.id);
          if ((shot.pierce ?? 0) > 0) shot.pierce!--;
          else {
            shot.life = 0;
            break;
          }
        }
      }
  }
  updateDrone(s, dt, {
    players,
    damage: (enemy, amount) => hurt(s, enemy, amount),
    emit: event => emit(s, event),
  });
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.shots = s.shots.filter((p) => p.life > 0);
  // The final boss fell this frame: the run ends as a win before any level-up can open.
  if (s.encounters.cleared) {
    s.phase = "won";
    return;
  }
  collectPickups(s, dt, players);
  if (!options.deferDiscovery) updateDiscovery(s, dt);
  if (!options.deferUpgrade) offerUpgrade(s);
}

export function enemyRadius(e: Enemy): number {
  return e.type === "boss"
    ? e.final
      ? 1.3 * FINAL_BOSS.scale
      : 1.3
    : e.type === "miniboss"
      ? 0.95
      : e.type === "brute"
        ? 0.65
        : 0.35;
}
function damagePlayer(s: State, amount: number) {
  if (s.immunity > 0 || s.hp <= 0) return;
  s.hp = Math.max(
    0,
    s.hp -
      Math.max(1, amount - s.upgrades.armor * 2 - s.config.damageReduction),
  );
  s.immunity = 0.85;
  emit(s, { kind: "hurt", ...s.player });
}
export const REVIVE_HEALTH = 50;
export const REVIVE_IMMUNITY = 2.5;
export const REVIVE_RADIUS = 5;
/** True when lethal damage will spend one of the run's automatic revives. */
export function canRevive(s: State): boolean {
  return s.revives > 0 && s.hp <= 0 && s.phase === "playing";
}
/**
 * Brings a downed robot back at half health with brief immunity and a clearing shockwave.
 * "auto" spends one of `s.revives` at the moment of lethal damage. "external" (for example a
 * rewarded ad on the defeat screen) is free and also reopens a run that just reached "lost".
 */
export function revive(s: State, source: "auto" | "external" = "auto"): boolean {
  if (source === "auto" ? !canRevive(s) : s.hp > 0 || (s.phase !== "playing" && s.phase !== "lost"))
    return false;
  if (source === "auto") s.revives--;
  s.stats.revivesUsed++;
  s.hp = REVIVE_HEALTH;
  s.immunity = REVIVE_IMMUNITY;
  s.phase = "playing";
  emit(s, { kind: "burst", ...s.player, radius: REVIVE_RADIUS });
  const damage = 20 + s.time / 10;
  for (const e of s.enemies) {
    const d = distance(s.player, e);
    if (e.hp <= 0 || d > REVIVE_RADIUS + enemyRadius(e)) continue;
    hurt(s, e, damage);
    // Closer enemies fly farther, so the robot always gets room to move.
    const push = 2 + 3 * (1 - d / (REVIVE_RADIUS + enemyRadius(e)));
    e.x += ((e.x - s.player.x) / (d || 1)) * push;
    e.z += ((e.z - s.player.z) / (d || 1)) * push;
    resolveObstacles(e, enemyRadius(e));
  }
  const c = s.encounters;
  c.projectiles = c.projectiles.filter((p) => distance(p, s.player) > 9);
  c.zones = c.zones.filter((z) => distance(z, s.player) > z.radius + REVIVE_RADIUS);
  return true;
}
/** Lethal damage spends a revive; otherwise the run ends and the frame stops. */
function survive(s: State): boolean {
  if (s.hp > 0 || revive(s)) return true;
  // A final boss that fell earlier in the same frame still clears the stage.
  s.phase = s.encounters.cleared ? "won" : "lost";
  return false;
}
function encounterHooks(s: State): EncounterHooks {
  return {
    spawnEnemy(type, position, hp) {
      if (s.enemies.length >= ENTITY_LIMITS.enemies) {
        const index = s.enemies.findIndex(
          (e) => e.type !== "boss" && e.type !== "miniboss",
        );
        if (index < 0) return;
        s.enemies.splice(index, 1);
      }
      const e: Enemy = {
        id: s.nextId++,
        ...position,
        type,
        hp,
        hit: 0,
        seed: random(s) * 10,
      };
      resolveObstacles(e, enemyRadius(e));
      s.enemies.push(e);
      s.spawned++;
      return e;
    },
    damagePlayer(amount, _source, target = s) {
      damagePlayer(target, amount);
    },
    reward(reward, enemy) {
      s.earnedParts += reward.parts;
      s.hp = Math.min(100, s.hp + reward.healing);
      s.scrap = Math.min(MAX_SCRAP, s.scrap + reward.scrap);
      addPickup(s, {
        x: enemy.x,
        z: enemy.z,
        id: s.nextId++,
        kind: "xp",
        born: s.time,
        value: reward.xp,
      });
    },
  };
}
