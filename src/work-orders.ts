import { EVOLUTIONS } from "./evolution-core";
import { STAGES, STAGE_IDS } from "./stages";
import type { Progress, RobotId, StageId } from "./progression";

/** Permanent goals with part rewards, checked against saved progress when a run is recorded. */
export type WorkOrderGroup =
  | "survival"
  | "combat"
  | "builds"
  | "explorer"
  | "robots"
  | "challenges";
export type WorkOrder = {
  id: string;
  group: WorkOrderGroup;
  /** English lookup key; {count}, {time}, {stage} and {robot} are filled in by the view. */
  title: string;
  target: number;
  reward: number;
  /** Lifetime totals, or the best single run for "in one shift" goals. */
  value: (p: Progress) => number;
  /** "best": a single-run record; "time": a single-run survival time in seconds. */
  measure: "total" | "best" | "time";
  stage?: StageId;
  robot?: RobotId;
};
export const WORK_ORDER_GROUPS: readonly WorkOrderGroup[] = [
  "survival",
  "combat",
  "builds",
  "explorer",
  "robots",
  "challenges",
];
type Robot = { readonly id: RobotId; readonly cost: number };
// Built on first use from the live robot, stage and evolution tables, so orders
// added by those tables (a new robot, stage or evolution) need no change here.
let built: { robots: readonly Robot[]; orders: WorkOrder[] } | undefined;
export function workOrders(robots: readonly Robot[]): readonly WorkOrder[] {
  if (built?.robots === robots) return built.orders;
  const evolutions = Object.keys(EVOLUTIONS).length;
  const order = (
    id: string,
    group: WorkOrderGroup,
    title: string,
    target: number,
    reward: number,
    value: WorkOrder["value"],
    measure: WorkOrder["measure"] = "total",
  ): WorkOrder => ({ id, group, title, target, reward, value, measure });
  const orders: WorkOrder[] = [
    ...[
      [2, 10],
      [5, 20],
      [10, 45],
    ].map(([minutes, reward]) =>
      order(`survive-${minutes}`, "survival", "Survive {time} in one shift", minutes * 60, reward, (p) => p.bestTime, "time"),
    ),
    ...STAGE_IDS.map((stage) => ({
      ...order(`clear-${stage}`, "survival", "Clear {stage}", 1, Math.round(60 * STAGES[stage].partsBonus), (p) => Number(p.clearedStages.includes(stage))),
      stage,
    })),
    order("kills-run", "combat", "Recycle {count} enemies in one shift", 500, 20, (p) => p.bestKills, "best"),
    order("kills-10k", "combat", "Recycle {count} enemies", 10_000, 40, (p) => p.stats.kills),
    order("kills-50k", "combat", "Recycle {count} enemies", 50_000, 60, (p) => p.stats.kills),
    order("miniboss", "combat", "Defeat a mini boss", 1, 10, (p) => p.stats.minibosses),
    order("boss", "combat", "Defeat a boss", 1, 20, (p) => p.stats.bosses),
    order("bosses-10", "combat", "Defeat {count} bosses", 10, 40, (p) => p.stats.bosses),
    order("elites-25", "combat", "Defeat {count} elite enemies", 25, 20, (p) => p.stats.elites),
    order("elites-150", "combat", "Defeat {count} elite enemies", 150, 40, (p) => p.stats.elites),
    ...[
      [10, 10],
      [20, 20],
      [30, 40],
    ].map(([level, reward]) =>
      order(`level-${level}`, "builds", "Reach level {count} in one shift", level, reward, (p) => p.stats.bestLevel, "best"),
    ),
    order("evolve", "builds", "Discover an evolution", 1, 20, (p) => p.evolutions.length),
    // "Several" stays below "every" while there are only a few evolutions.
    order("evolve-some", "builds", "Discover {count} different evolutions", Math.max(2, Math.min(3, evolutions - 1)), 35, (p) => p.evolutions.length),
    order("evolve-all", "builds", "Discover every evolution", evolutions, 60, (p) => p.evolutions.length),
    order("specialize", "builds", "Choose a weapon specialization", 1, 10, (p) => p.stats.specializations),
    order("chests-run", "explorer", "Open {count} supply chests in one shift", 3, 15, (p) => p.stats.bestChests, "best"),
    order("contracts-run", "explorer", "Complete {count} salvage contracts in one shift", 2, 20, (p) => p.stats.bestContracts, "best"),
    order("chests-25", "explorer", "Open {count} supply chests", 25, 25, (p) => p.stats.chests),
    ...robots
      .filter((robot) => robot.cost > 0)
      .map((robot) => ({
        ...order(`robot-${robot.id}`, "robots", "Finish a shift as {robot}", 1, 15, (p) => Number(p.robotsUsed.includes(robot.id))),
        robot: robot.id,
      })),
    order("robots-all", "robots", "Unlock every robot", robots.length, 30, (p) => p.unlockedRobots.length),
    order("daily", "challenges", "Complete a Daily Shift", 1, 15, (p) => p.daily.days),
    order("daily-7", "challenges", "Complete {count} Daily Shifts", 7, 45, (p) => p.daily.days),
    order("streak-3", "challenges", "Reach a {count}-day streak", 3, 25, (p) => p.daily.longest),
    order("streak-7", "challenges", "Reach a {count}-day streak", 7, 60, (p) => p.daily.longest),
  ];
  built = { robots, orders };
  return orders;
}
/** Orders whose goal is met but which are not saved as completed yet. */
export const dueWorkOrders = (p: Progress, robots: readonly Robot[]) =>
  workOrders(robots).filter(
    (o) => !p.orders.includes(o.id) && o.value(p) >= o.target,
  );
/** The unmet order nearest to completion, as a reason to play again. */
export function nextWorkOrder(p: Progress, robots: readonly Robot[]) {
  let best: WorkOrder | undefined,
    ratio = -1;
  for (const o of workOrders(robots)) {
    const r = o.value(p) / o.target;
    if (p.orders.includes(o.id) || r >= 1) continue;
    if (r > ratio) {
      best = o;
      ratio = r;
    }
  }
  return best;
}
