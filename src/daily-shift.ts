import type { RunModifiers } from "./progression";
import type { UpgradeId } from "./simulation";

/** One seeded challenge per local calendar day, plus the saved streak it builds. */
export type DailyRule = {
  id: string;
  name: string;
  description: string;
  /** Ability art that illustrates the rule. */
  art: UpgradeId;
  modifiers: RunModifiers;
};
export type DailyShift = { key: string; seed: number; rule: DailyRule };
/** Saved Daily Shift history: the last finished date, its best time and the streak. */
export type DailyProgress = {
  date: string;
  best: number;
  streak: number;
  longest: number;
  days: number;
};
export type DailyResult = {
  date: string;
  time: number;
  best: number;
  /** The first finished run on this date earns the reward and extends the streak. */
  first: boolean;
  reward: number;
  streak: number;
};
export const DAILY_REWARD = 20;
export const DAILY_STREAK_REWARD = 5;
export const DAILY_STREAK_CAP = 7;

// Neutral values mirror NO_MODIFIERS; progression imports this module, so it can't import them back.
const rule = (
  id: string,
  name: string,
  description: string,
  art: UpgradeId,
  changes: Partial<RunModifiers>,
): DailyRule => ({
  id,
  name,
  description,
  art,
  modifiers: {
    enemyHealth: 1,
    enemySpeed: 1,
    spawnRate: 1,
    eliteChance: 0,
    bannedUpgrades: [],
    startingUpgrades: {},
    ...changes,
  },
});
export const DAILY_RULES: readonly DailyRule[] = [
  rule("glass-swarm", "Glass Swarm", "Enemies have 30% less health, but 50% more of them spawn.", "saw", { enemyHealth: 0.7, spawnRate: 1.5 }),
  rule("heavy-metal", "Heavy Metal", "Enemies have 50% more health, and elites turn up more often.", "armor", { enemyHealth: 1.5, eliteChance: 0.08 }),
  rule("no-repairs", "No Repairs", "Field Repair is never offered. Every hit counts.", "repair", { bannedUpgrades: ["repair"] }),
  rule("storm-front", "Storm Front", "Chain Lightning starts at rank 2.", "lightning", { startingUpgrades: { lightning: 2 } }),
  rule("rush-hour", "Rush Hour", "Enemies move 20% faster.", "boots", { enemySpeed: 1.2 }),
  rule("turret-town", "Turret Town", "Scrap Turret starts at rank 2.", "turret", { startingUpgrades: { turret: 2 } }),
  rule("elite-patrol", "Elite Patrol", "Elite enemies turn up far more often.", "overclock", { eliteChance: 0.15 }),
  rule("shock-wave", "Shock Wave", "Magnetic Burst starts at rank 2, but 20% more enemies spawn.", "burst", { startingUpgrades: { burst: 2 }, spawnRate: 1.2 }),
  rule("magnet-mayhem", "Magnet Mayhem", "Pickup Magnet starts at rank 2, but enemies move 10% faster.", "magnet", { startingUpgrades: { magnet: 2 }, enemySpeed: 1.1 }),
  rule("drone-day", "Drone Day", "Your Guard Drone starts at rank 2.", "drone_guard", { startingUpgrades: { drone_guard: 2 } }),
];

const pad = (n: number) => String(n).padStart(2, "0");
/** The local calendar date, so the shift changes at the player's midnight. */
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
/** Whole days since the epoch; keys are calendar dates, so no timezone applies. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
export function getDailyShift(date = new Date()): DailyShift {
  const key = dateKey(date);
  // FNV-1a keeps the seed stable across builds and platforms.
  let seed = 2166136261;
  for (const char of `junk-magnet-daily:${key}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  // A step coprime with the rule count visits every rule before repeating one.
  const index = (((dayNumber(key) * 7) % DAILY_RULES.length) + DAILY_RULES.length) % DAILY_RULES.length;
  const preset = DAILY_RULES[index];
  return { key, seed, rule: { ...preset, modifiers: structuredClone(preset.modifiers) } };
}
/** The shift for a saved date key, such as the date a Daily Shift run started. */
export function dailyShiftFor(key: string): DailyShift {
  const [y, m, d] = key.split("-").map(Number);
  return getDailyShift(new Date(y, m - 1, d, 12));
}
export const dailyReward = (streak: number) =>
  DAILY_REWARD + DAILY_STREAK_REWARD * Math.min(DAILY_STREAK_CAP, Math.max(1, streak));
/** The streak still alive on `key`: finished today or yesterday. */
export function currentStreak(daily: DailyProgress, key: string): number {
  if (!daily.date) return 0;
  const gap = dayNumber(key) - dayNumber(daily.date);
  return gap === 0 || gap === 1 ? daily.streak : 0;
}
/** The streak that finishing the shift on `key` would give. */
export function nextStreak(daily: DailyProgress, key: string): number {
  if (!daily.date) return 1;
  const gap = dayNumber(key) - dayNumber(daily.date);
  return gap === 0 ? daily.streak : gap === 1 ? daily.streak + 1 : 1;
}
/** Folds a finished Daily Shift run into saved history; a missed day restarts the streak. */
export function recordDaily(
  daily: DailyProgress,
  key: string,
  time: number,
): DailyResult {
  const gap = daily.date ? dayNumber(key) - dayNumber(daily.date) : Infinity;
  if (gap === 0) {
    daily.best = Math.max(daily.best, time);
    return { date: key, time, best: daily.best, first: false, reward: 0, streak: daily.streak };
  }
  // Any other gap, including a clock moved backwards, starts a new streak.
  daily.streak = gap === 1 ? daily.streak + 1 : 1;
  daily.longest = Math.max(daily.longest, daily.streak);
  daily.days++;
  daily.date = key;
  daily.best = time;
  return { date: key, time, best: time, first: true, reward: dailyReward(daily.streak), streak: daily.streak };
}
