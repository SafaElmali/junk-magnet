import { gameStorage, type StorageLike } from "./storage";
import type { UpgradeId } from "./simulation";
import type { RunSummary } from "./run-summary";
import { STAGES, STAGE_IDS } from "./stages";
import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { dueWorkOrders, workOrders } from "./work-orders";
import {
  isDateKey,
  recordDaily,
  type DailyProgress,
  type DailyResult,
} from "./daily-shift";

/** Local, versioned workshop progress. Combat takes an immutable copy per run. */
export type RobotId = "scrap" | "scout" | "volt" | "magna";
export type PermanentUpgrade =
  | "hull"
  | "magnet"
  | "rerolls"
  | "banishes"
  | "revive"
  | "xp"
  | "scrap"
  | "salvage";
export type StartingWeapon = "saw" | "lightning" | "turret" | "burst";
export type StageId = "yard" | "night";
/** Challenge rules layered on a run, such as a Daily Shift. Neutral values change nothing. */
export type RunModifiers = {
  enemyHealth: number;
  enemySpeed: number;
  spawnRate: number;
  /** Added to the normal elite spawn chance. */
  eliteChance: number;
  /** Never offered at level-up during this run. */
  bannedUpgrades: UpgradeId[];
  /** Minimum ranks when the run starts; a starting weapon already at that rank keeps it. */
  startingUpgrades: Partial<Record<UpgradeId, number>>;
};
export const NO_MODIFIERS: RunModifiers = {
  enemyHealth: 1,
  enemySpeed: 1,
  spawnRate: 1,
  eliteChance: 0,
  bannedUpgrades: [],
  startingUpgrades: {},
};
export type RunConfig = {
  robotId: RobotId;
  startingWeapon: StartingWeapon;
  speedMultiplier: number;
  pickupBonus: number;
  damageReduction: number;
  damageMultiplier: number;
  stage: StageId;
  /** Initial simulation RNG state. Daily Shifts share one seed per date. */
  seed: number;
  /** Level-up redraws available this run. */
  rerolls: number;
  /** Level-up choices the player can remove from the pool this run. */
  banishes: number;
  /** Automatic revives at half health this run. */
  revives: number;
  xpMultiplier: number;
  /** Applied to parts banked at the end of the run. */
  partsMultiplier: number;
  startingScrap: number;
  modifiers: RunModifiers;
  /** Local date key (YYYY-MM-DD) when this run is that day's Daily Shift. */
  daily: string | null;
};
export const ROBOTS = [
  {
    id: "scrap",
    name: "SCRAP-01",
    cost: 0,
    description: "Reliable scrapper. +10% damage.",
    startingWeapon: "saw",
    speedMultiplier: 1,
    pickupBonus: 0,
    damageReduction: 0,
    damageMultiplier: 1.1,
  },
  {
    id: "scout",
    name: "SCOUT",
    cost: 80,
    description: "Quick collector. +18% speed, +0.8 m pickup range.",
    startingWeapon: "saw",
    speedMultiplier: 1.18,
    pickupBonus: 0.8,
    damageReduction: 0,
    damageMultiplier: 1,
  },
  {
    id: "volt",
    name: "VOLT",
    cost: 120,
    description: "Electric specialist. +15% damage, −5% speed.",
    startingWeapon: "lightning",
    speedMultiplier: 0.95,
    pickupBonus: 0,
    damageReduction: 0,
    damageMultiplier: 1.15,
  },
  {
    id: "magna",
    name: "MAGNA",
    cost: 160,
    description: "Heavy magnet unit. +2 armor, +0.4 m pickup range, −8% speed.",
    startingWeapon: "burst",
    speedMultiplier: 0.92,
    pickupBonus: 0.4,
    // Flat contact armor, stacking with Reinforced Hull and Steel Plating.
    damageReduction: 2,
    damageMultiplier: 1,
  },
] as const;
export const UPGRADE_PRICES = [25, 60, 110] as const;
/** Part prices per rank; the array length is the upgrade's maximum rank. */
export const WORKSHOP_UPGRADES: Record<PermanentUpgrade, readonly number[]> = {
  hull: UPGRADE_PRICES,
  magnet: UPGRADE_PRICES,
  rerolls: [50, 120, 220],
  banishes: [80, 180],
  revive: [400],
  xp: [70, 160, 280],
  scrap: [40, 100],
  salvage: [90, 200, 360],
};
export const PERMANENT_UPGRADES = Object.keys(
  WORKSHOP_UPGRADES,
) as PermanentUpgrade[];
/** Every solo run starts with these level-up tools before workshop bonuses. */
export const BASE_REROLLS = 1;
export const BASE_BANISHES = 1;
export const DEFAULT_RUN_CONFIG: RunConfig = {
  robotId: "scrap",
  startingWeapon: "saw",
  speedMultiplier: 1,
  pickupBonus: 0,
  damageReduction: 0,
  damageMultiplier: 1.1,
  stage: "yard",
  seed: 41,
  rerolls: 0,
  banishes: 0,
  revives: 0,
  xpMultiplier: 1,
  partsMultiplier: 1,
  startingScrap: 0,
  modifiers: NO_MODIFIERS,
  daily: null,
};
/** The fields recordRun needs; summarizeRun supplies the rest for goals and stats. */
export type RunRecord = Pick<
  RunSummary,
  "runId" | "time" | "kills" | "earnedParts"
> & { phase: string } & Partial<Omit<RunSummary, "phase">>;
/** Lifetime counters and single-run records that work orders read. */
export type LifetimeStats = {
  kills: number;
  bosses: number;
  minibosses: number;
  elites: number;
  chests: number;
  contracts: number;
  clears: number;
  specializations: number;
  bestLevel: number;
  bestChests: number;
  bestContracts: number;
};
export type Progress = {
  version: 1;
  parts: number;
  selectedRobot: RobotId;
  unlockedRobots: RobotId[];
  upgrades: Record<PermanentUpgrade, number>;
  bestTime: number;
  bestKills: number;
  completedRuns: number;
  recentRunIds: string[];
  // Later fields are optional in stored JSON; loadProgress fills them for older saves.
  stage: StageId;
  clearedStages: StageId[];
  /** Longest run per stage; runs before stages existed were all in the yard. */
  stageBest: Partial<Record<StageId, number>>;
  stats: LifetimeStats;
  evolutions: EvolutionId[];
  robotsUsed: RobotId[];
  /** Completed work orders, oldest first. */
  orders: string[];
  /** Completed orders already shown on the Work Orders page. */
  ordersSeen: number;
  daily: DailyProgress;
  /** Runs whose banked parts already received a one-time bonus. */
  bonusRunIds: string[];
};
export type RunReceipt = {
  runId: string;
  /** Parts from this run after stage and Salvage License multipliers. */
  earned: number;
  /** Stage bonus times Salvage License bonus. */
  multiplier: number;
  /** Bank after every reward in this receipt. */
  parts: number;
  bestTime: number;
  bestKills: number;
  orders: { id: string; reward: number }[];
  daily: DailyResult | null;
  /** A stage this run's clear made available. */
  unlockedStage: StageId | null;
};
export const PROGRESS_KEY = "junk-magnet-workshop-v1";
const integer = (v: unknown, max = 1_000_000) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(0, Math.floor(v)))
    : 0;
const robotId = (v: unknown): v is RobotId => ROBOTS.some((r) => r.id === v);
const stageId = (v: unknown): v is StageId =>
  STAGE_IDS.includes(v as StageId);
/** Unique entries of an unknown array that belong to `allowed`, in saved order. */
const known = <T>(values: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(values)
    ? [...new Set(values.filter((v): v is T => allowed.includes(v as T)))]
    : [];
const runIds = (values: unknown, limit: number) =>
  Array.isArray(values)
    ? [
        ...new Set<string>(
          values.filter(
            (id: unknown) =>
              typeof id === "string" && id.length > 0 && id.length <= 128,
          ),
        ),
      ].slice(-limit)
    : [];
export function stageUnlocked(
  progress: Pick<Progress, "clearedStages">,
  id: StageId,
): boolean {
  const by = STAGES[id]?.unlockedBy;
  return by === null || (by !== undefined && progress.clearedStages.includes(by));
}
export function loadProgress(storage = gameStorage()): Progress {
  let data: Record<string, any> | null = null;
  try {
    data = JSON.parse(storage?.getItem(PROGRESS_KEY) ?? "null");
  } catch {
    data = null;
  }
  // Unknown versions and corrupt saves start fresh; every field below has a default.
  if (!data || typeof data !== "object" || data.version !== 1) data = {};
  const unlockedRobots: RobotId[] = [
    "scrap",
    ...known<RobotId>(
      data.unlockedRobots,
      ROBOTS.map((r) => r.id),
    ).filter((id) => id !== "scrap"),
  ];
  const clearedStages = known<StageId>(data.clearedStages, STAGE_IDS);
  const stats = data.stats ?? {};
  const daily = data.daily ?? {};
  const orders = known<string>(
    data.orders,
    workOrders(ROBOTS).map((o) => o.id),
  );
  const streak = integer(daily.streak, 100_000);
  return {
    version: 1,
    parts: integer(data.parts),
    selectedRobot:
      robotId(data.selectedRobot) &&
      unlockedRobots.includes(data.selectedRobot)
        ? data.selectedRobot
        : "scrap",
    unlockedRobots,
    upgrades: Object.fromEntries(
      PERMANENT_UPGRADES.map((id) => [
        id,
        integer(data.upgrades?.[id], WORKSHOP_UPGRADES[id].length),
      ]),
    ) as Record<PermanentUpgrade, number>,
    bestTime: integer(data.bestTime),
    bestKills: integer(data.bestKills),
    completedRuns: integer(data.completedRuns),
    recentRunIds: runIds(data.recentRunIds, 64),
    stage:
      stageId(data.stage) && stageUnlocked({ clearedStages }, data.stage)
        ? data.stage
        : "yard",
    clearedStages,
    stageBest: Object.fromEntries(
      STAGE_IDS.map((id) => [
        id,
        Math.max(
          integer(data.stageBest?.[id]),
          id === "yard" && !data.stageBest ? integer(data.bestTime) : 0,
        ),
      ]).filter(([, time]) => time),
    ),
    stats: {
      kills: integer(stats.kills, 1_000_000_000),
      bosses: integer(stats.bosses),
      minibosses: integer(stats.minibosses),
      elites: integer(stats.elites),
      chests: integer(stats.chests),
      contracts: integer(stats.contracts),
      clears: integer(stats.clears),
      specializations: integer(stats.specializations),
      bestLevel: integer(stats.bestLevel),
      bestChests: integer(stats.bestChests),
      bestContracts: integer(stats.bestContracts),
    },
    evolutions: known<EvolutionId>(
      data.evolutions,
      Object.keys(EVOLUTIONS) as EvolutionId[],
    ),
    robotsUsed: known<RobotId>(
      data.robotsUsed,
      ROBOTS.map((r) => r.id),
    ),
    orders,
    ordersSeen: Math.min(orders.length, integer(data.ordersSeen)),
    daily: isDateKey(daily.date)
      ? {
          date: daily.date,
          best: integer(daily.best),
          streak: Math.max(1, streak),
          longest: Math.max(Math.max(1, streak), integer(daily.longest, 100_000)),
          days: Math.max(1, integer(daily.days)),
        }
      : { date: "", best: 0, streak: 0, longest: integer(daily.longest, 100_000), days: integer(daily.days) },
    bonusRunIds: runIds(data.bonusRunIds, 16),
  };
}
export function saveProgress(
  progress: Progress,
  storage = gameStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
/** The next rank's price, or undefined at the maximum rank. */
export const upgradeCost = (progress: Progress, id: PermanentUpgrade) =>
  WORKSHOP_UPGRADES[id][progress.upgrades[id]];
/** True when saved parts cover a locked robot or the next permanent upgrade rank. */
export function canAffordWorkshop(progress: Progress): boolean {
  return (
    ROBOTS.some(
      (robot) =>
        !progress.unlockedRobots.includes(robot.id) &&
        progress.parts >= robot.cost,
    ) ||
    PERMANENT_UPGRADES.some((id) => {
      const cost = upgradeCost(progress, id);
      return cost !== undefined && progress.parts >= cost;
    })
  );
}
/** Separate instances let tests exercise storage denial without browser globals. */
export function createProgression(storage = gameStorage()) {
  let progress = loadProgress(storage);
  const persist = () => {
    saveProgress(progress, storage);
  };
  const addParts = (amount: number) => {
    progress.parts = Math.min(1_000_000, progress.parts + amount);
  };
  return {
    getProgress: () => structuredClone(progress),
    selectRobot(id: RobotId): boolean {
      if (!robotId(id) || !progress.unlockedRobots.includes(id)) return false;
      progress.selectedRobot = id;
      persist();
      return true;
    },
    unlockRobot(id: RobotId): boolean {
      const robot = ROBOTS.find((r) => r.id === id);
      if (
        !robot ||
        progress.unlockedRobots.includes(id) ||
        progress.parts < robot.cost
      )
        return false;
      progress.parts -= robot.cost;
      progress.unlockedRobots.push(id);
      persist();
      return true;
    },
    buyUpgrade(id: PermanentUpgrade): boolean {
      if (!PERMANENT_UPGRADES.includes(id)) return false;
      const cost = upgradeCost(progress, id);
      if (cost === undefined || progress.parts < cost) return false;
      progress.parts -= cost;
      progress.upgrades[id]++;
      persist();
      return true;
    },
    selectStage(id: StageId): boolean {
      if (!stageId(id) || !stageUnlocked(progress, id)) return false;
      progress.stage = id;
      persist();
      return true;
    },
    /** Marks every completed order as shown and returns the ones that were new. */
    markOrdersSeen(): string[] {
      const fresh = progress.orders.slice(progress.ordersSeen);
      if (fresh.length) {
        progress.ordersSeen = progress.orders.length;
        persist();
      }
      return fresh;
    },
    getRunConfig(): RunConfig {
      const robot = ROBOTS.find((r) => r.id === progress.selectedRobot)!;
      const u = progress.upgrades;
      return {
        ...DEFAULT_RUN_CONFIG,
        robotId: robot.id,
        startingWeapon: robot.startingWeapon,
        speedMultiplier: robot.speedMultiplier,
        damageMultiplier: robot.damageMultiplier,
        pickupBonus: robot.pickupBonus + u.magnet * 0.35,
        damageReduction: robot.damageReduction + u.hull,
        stage: stageUnlocked(progress, progress.stage) ? progress.stage : "yard",
        rerolls: BASE_REROLLS + u.rerolls,
        banishes: BASE_BANISHES + u.banishes,
        revives: u.revive,
        xpMultiplier: (100 + 5 * u.xp) / 100,
        partsMultiplier: (10 + u.salvage) / 10,
        startingScrap: 4 * u.scrap,
      };
    },
    recordRun(run: RunRecord): RunReceipt | null {
      if (
        (run.phase !== "lost" && run.phase !== "won") ||
        typeof run.runId !== "string" ||
        !run.runId.length ||
        run.runId.length > 128 ||
        progress.recentRunIds.includes(run.runId)
      )
        return null;
      const time = integer(run.time),
        kills = integer(run.kills),
        stage = stageId(run.stage) ? run.stage : "yard",
        license = Number.isFinite(run.partsMultiplier)
          ? Math.min(3, Math.max(1, run.partsMultiplier!))
          : 1;
      // Whole percentages keep 1.5 × 1.3 from flooring to one part less.
      const percent = Math.round(STAGES[stage].partsBonus * 100 * license);
      const earned = Math.min(
        1_000_000,
        Math.floor(
          ((integer(run.earnedParts) +
            Math.floor(kills / 10) +
            Math.floor(time / 30)) *
            percent) /
            100,
        ),
      );
      addParts(earned);
      progress.bestTime = Math.max(progress.bestTime, time);
      progress.stageBest[stage] = Math.max(progress.stageBest[stage] ?? 0, time);
      progress.bestKills = Math.max(progress.bestKills, kills);
      progress.completedRuns = Math.min(1_000_000, progress.completedRuns + 1);
      progress.recentRunIds = [...progress.recentRunIds, run.runId].slice(-64);
      const stats = progress.stats,
        add = (key: keyof LifetimeStats, value: unknown, max = 1_000_000) => {
          stats[key] = Math.min(max, stats[key] + integer(value));
        };
      add("kills", kills, 1_000_000_000);
      add("bosses", run.bossKills);
      add("minibosses", run.minibossKills);
      add("elites", run.eliteKills);
      add("chests", run.chestsOpened);
      add("contracts", run.questsCompleted);
      add("specializations", run.specializations);
      stats.bestLevel = Math.max(stats.bestLevel, integer(run.level));
      stats.bestChests = Math.max(stats.bestChests, integer(run.chestsOpened));
      stats.bestContracts = Math.max(
        stats.bestContracts,
        integer(run.questsCompleted),
      );
      progress.evolutions = known<EvolutionId>(
        [...progress.evolutions, ...(run.evolutions ?? [])],
        Object.keys(EVOLUTIONS) as EvolutionId[],
      );
      if (robotId(run.robotId) && !progress.robotsUsed.includes(run.robotId))
        progress.robotsUsed.push(run.robotId);
      let unlockedStage: StageId | null = null;
      if (run.phase === "won") {
        add("clears", 1);
        if (!progress.clearedStages.includes(stage)) {
          progress.clearedStages.push(stage);
          unlockedStage =
            STAGE_IDS.find((id) => STAGES[id].unlockedBy === stage) ?? null;
        }
      }
      const daily = isDateKey(run.daily)
        ? recordDaily(progress.daily, run.daily, time)
        : null;
      if (daily) addParts(daily.reward);
      const orders = dueWorkOrders(progress, ROBOTS).map((o) => {
        progress.orders.push(o.id);
        addParts(o.reward);
        return { id: o.id, reward: o.reward };
      });
      persist();
      return {
        runId: run.runId,
        earned,
        multiplier: percent / 100,
        parts: progress.parts,
        bestTime: progress.bestTime,
        bestKills: progress.bestKills,
        orders,
        daily,
        unlockedStage,
      };
    },
    /** Adds a one-time bonus to a recorded run (for example, doubled parts). */
    grantBonusParts(runId: string, amount: number): number {
      const bonus = Math.min(1_000_000 - progress.parts, integer(amount));
      if (
        bonus <= 0 ||
        !progress.recentRunIds.includes(runId) ||
        progress.bonusRunIds.includes(runId)
      )
        return 0;
      progress.bonusRunIds = [...progress.bonusRunIds, runId].slice(-16);
      addParts(bonus);
      persist();
      return bonus;
    },
  };
}
const workshop = createProgression();
export const {
  getProgress,
  selectRobot,
  unlockRobot,
  buyUpgrade,
  selectStage,
  markOrdersSeen,
  getRunConfig,
  recordRun,
  grantBonusParts,
} = workshop;
