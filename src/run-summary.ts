import type { EvolutionId } from "./evolution-core";
import type { RobotId, StageId } from "./progression";
import type { State } from "./simulation";

/** Everything a finished run reports to saved progress, work orders and the Daily Shift. */
export type RunSummary = {
  runId: string;
  /** Defeat, or a cleared stage. */
  phase: "lost" | "won";
  stage: StageId;
  daily: string | null;
  robotId: RobotId;
  time: number;
  kills: number;
  level: number;
  earnedParts: number;
  bossKills: number;
  minibossKills: number;
  eliteKills: number;
  chestsOpened: number;
  questsCompleted: number;
  evolutions: EvolutionId[];
  specializations: number;
  revivesUsed: number;
  rerollsUsed: number;
  banishesUsed: number;
  /** The run's Salvage License bonus, applied when parts are banked. */
  partsMultiplier: number;
};

/** Null while the run is still in progress. */
export function summarizeRun(s: State, runId: string): RunSummary | null {
  if (s.phase !== "lost" && s.phase !== "won") return null;
  return {
    runId,
    phase: s.phase,
    stage: s.config.stage,
    daily: s.config.daily,
    robotId: s.config.robotId,
    time: s.time,
    kills: s.kills,
    level: s.level,
    earnedParts: s.earnedParts,
    bossKills: s.stats.bossKills,
    minibossKills: s.stats.minibossKills,
    eliteKills: s.stats.eliteKills,
    chestsOpened: s.discovery.chestsOpened,
    questsCompleted: s.discovery.questsCompleted,
    evolutions: (Object.keys(s.evolutions) as EvolutionId[]).filter(
      (id) => s.evolutions[id],
    ),
    specializations: Object.values(s.specializations).filter(Boolean).length,
    revivesUsed: s.stats.revivesUsed,
    rerollsUsed: s.stats.rerollsUsed,
    banishesUsed: s.stats.banishesUsed,
    partsMultiplier: s.config.partsMultiplier,
  };
}
