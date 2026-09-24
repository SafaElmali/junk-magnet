import type { StageId } from "./progression";

/** The final boss arrives at this survival time; defeating it clears the stage. */
export const CLEAR_TIME = 900;

/** Stage copy, unlock order and difficulty. Multipliers stack with Daily Shift modifiers. */
export const STAGES: Record<
  StageId,
  {
    name: string;
    description: string;
    /** Clearing this stage unlocks it; null means always available. */
    unlockedBy: StageId | null;
    enemyHealth: number;
    enemySpeed: number;
    spawnRate: number;
    /** Added to the elite spawn chance. */
    eliteChance: number;
    bossHealth: number;
    /** Multiplies parts banked from runs on this stage. */
    partsBonus: number;
  }
> = {
  yard: {
    name: "THE SCRAPYARD",
    description: "Final boss at 15:00 · Rising pressure",
    unlockedBy: null,
    enemyHealth: 1,
    enemySpeed: 1,
    spawnRate: 1,
    eliteChance: 0,
    bossHealth: 1,
    partsBonus: 1,
  },
  night: {
    name: "NIGHT SHIFT",
    description: "Tougher swarm · +50% parts",
    unlockedBy: "yard",
    enemyHealth: 1.4,
    enemySpeed: 1.1,
    spawnRate: 1.2,
    eliteChance: 0.05,
    bossHealth: 1.35,
    partsBonus: 1.5,
  },
};
export const STAGE_IDS = Object.keys(STAGES) as StageId[];
