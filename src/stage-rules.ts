import { NO_MODIFIERS, type RunConfig } from "./progression";
import { STAGES } from "./stages";

/** How the stage and challenge modifiers scale a run. Both stack multiplicatively. */
type Rules = Pick<RunConfig, "stage"> & Partial<Pick<RunConfig, "modifiers">>;
const stage = (c: Rules) => STAGES[c.stage] ?? STAGES.yard;
const modifiers = (c: Rules) => c.modifiers ?? NO_MODIFIERS;

export const enemyHealthScale = (c: Rules) =>
  stage(c).enemyHealth * modifiers(c).enemyHealth;
export const enemySpeedScale = (c: Rules) =>
  stage(c).enemySpeed * modifiers(c).enemySpeed;
export const spawnRateScale = (c: Rules) =>
  stage(c).spawnRate * modifiers(c).spawnRate;
/** Bosses follow the stage's boss multiplier and a challenge's enemy health. */
export const bossHealthScale = (c: Rules) =>
  stage(c).bossHealth * modifiers(c).enemyHealth;
export const bannedUpgrades = (c: Rules) => modifiers(c).bannedUpgrades;
