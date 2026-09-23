/** Local, versioned workshop progress. Combat takes an immutable copy per run. */
export type RobotId = "scrap" | "scout" | "volt";
export type PermanentUpgrade = "hull" | "magnet";
export type RunConfig = {
  robotId: RobotId;
  startingWeapon: "saw" | "lightning";
  speedMultiplier: number;
  pickupBonus: number;
  damageReduction: number;
  damageMultiplier: number;
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
] as const;
export const UPGRADE_PRICES = [25, 60, 110] as const;
export const DEFAULT_RUN_CONFIG: RunConfig = {
  robotId: "scrap",
  startingWeapon: "saw",
  speedMultiplier: 1,
  pickupBonus: 0,
  damageReduction: 0,
  damageMultiplier: 1.1,
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
};
export type RunReceipt = {
  earned: number;
  parts: number;
  bestTime: number;
  bestKills: number;
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export const PROGRESS_KEY = "junk-magnet-workshop-v1";
const integer = (v: unknown, max = 1_000_000) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(0, Math.floor(v)))
    : 0;
const robotId = (v: unknown): v is RobotId => ROBOTS.some((r) => r.id === v);
const fresh = (): Progress => ({
  version: 1,
  parts: 0,
  selectedRobot: "scrap",
  unlockedRobots: ["scrap"],
  upgrades: { hull: 0, magnet: 0 },
  bestTime: 0,
  bestKills: 0,
  completedRuns: 0,
  recentRunIds: [],
});
function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
export function loadProgress(storage = browserStorage()): Progress {
  try {
    const data = JSON.parse(storage?.getItem(PROGRESS_KEY) ?? "null");
    if (!data || data.version !== 1 || typeof data !== "object") return fresh();
    const unlockedRobots: RobotId[] = [
      "scrap",
      ...new Set<RobotId>(
        Array.isArray(data.unlockedRobots)
          ? data.unlockedRobots.filter(
              (id: unknown) => robotId(id) && id !== "scrap",
            )
          : [],
      ),
    ];
    return {
      version: 1,
      parts: integer(data.parts),
      selectedRobot:
        robotId(data.selectedRobot) &&
        unlockedRobots.includes(data.selectedRobot)
          ? data.selectedRobot
          : "scrap",
      unlockedRobots,
      upgrades: {
        hull: integer(data.upgrades?.hull, 3),
        magnet: integer(data.upgrades?.magnet, 3),
      },
      bestTime: integer(data.bestTime),
      bestKills: integer(data.bestKills),
      completedRuns: integer(data.completedRuns),
      recentRunIds: Array.isArray(data.recentRunIds)
        ? [
            ...new Set<string>(
              data.recentRunIds.filter(
                (id: unknown) =>
                  typeof id === "string" && id.length > 0 && id.length <= 128,
              ),
            ),
          ].slice(-64)
        : [],
    };
  } catch {
    return fresh();
  }
}
export function saveProgress(
  progress: Progress,
  storage = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
/** True when saved parts cover a locked robot or the next permanent upgrade rank. */
export function canAffordWorkshop(progress: Progress): boolean {
  return (
    ROBOTS.some(
      (robot) =>
        !progress.unlockedRobots.includes(robot.id) &&
        progress.parts >= robot.cost,
    ) ||
    (["hull", "magnet"] as const).some((id) => {
      const cost = UPGRADE_PRICES[progress.upgrades[id]];
      return cost !== undefined && progress.parts >= cost;
    })
  );
}
/** Separate instances let tests exercise storage denial without browser globals. */
export function createProgression(storage = browserStorage()) {
  let progress = loadProgress(storage);
  const persist = () => {
    saveProgress(progress, storage);
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
      if (id !== "hull" && id !== "magnet") return false;
      const rank = progress.upgrades[id],
        cost = UPGRADE_PRICES[rank];
      if (cost === undefined || progress.parts < cost) return false;
      progress.parts -= cost;
      progress.upgrades[id]++;
      persist();
      return true;
    },
    getRunConfig(): RunConfig {
      const robot = ROBOTS.find((r) => r.id === progress.selectedRobot)!;
      return {
        robotId: robot.id,
        startingWeapon: robot.startingWeapon,
        speedMultiplier: robot.speedMultiplier,
        damageMultiplier: robot.damageMultiplier,
        pickupBonus: robot.pickupBonus + progress.upgrades.magnet * 0.35,
        damageReduction: robot.damageReduction + progress.upgrades.hull,
      };
    },
    recordRun(run: {
      runId: string;
      phase: string;
      time: number;
      kills: number;
      earnedParts: number;
    }): RunReceipt | null {
      if (
        run.phase !== "lost" ||
        typeof run.runId !== "string" ||
        !run.runId.length ||
        run.runId.length > 128 ||
        progress.recentRunIds.includes(run.runId)
      )
        return null;
      const time = integer(run.time),
        kills = integer(run.kills);
      const earned = Math.min(
        1_000_000,
        integer(run.earnedParts) +
          Math.floor(kills / 10) +
          Math.floor(time / 30),
      );
      progress.parts = Math.min(1_000_000, progress.parts + earned);
      progress.bestTime = Math.max(progress.bestTime, time);
      progress.bestKills = Math.max(progress.bestKills, kills);
      progress.completedRuns = Math.min(1_000_000, progress.completedRuns + 1);
      progress.recentRunIds = [...progress.recentRunIds, run.runId].slice(-64);
      persist();
      return {
        earned,
        parts: progress.parts,
        bestTime: progress.bestTime,
        bestKills: progress.bestKills,
      };
    },
  };
}
const workshop = createProgression();
export const {
  getProgress,
  selectRobot,
  unlockRobot,
  buyUpgrade,
  getRunConfig,
  recordRun,
} = workshop;
