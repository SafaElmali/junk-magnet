import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_RULES,
  currentStreak,
  dailyReward,
  dateKey,
  dayNumber,
  getDailyShift,
  isDateKey,
  nextStreak,
  recordDaily,
  type DailyProgress,
} from "./daily-shift";
import { UPGRADES } from "./simulation";

const empty = (): DailyProgress => ({
  date: "",
  best: 0,
  streak: 0,
  longest: 0,
  days: 0,
});

test("the same local date always gives the same shift, and dates vary", () => {
  const morning = getDailyShift(new Date(2026, 8, 24, 0, 5));
  const night = getDailyShift(new Date(2026, 8, 24, 23, 55));
  assert.equal(morning.key, "2026-09-24");
  assert.deepEqual(night, morning);
  const next = getDailyShift(new Date(2026, 8, 25, 12));
  assert.equal(next.key, "2026-09-25");
  assert.notEqual(next.seed, morning.seed);
  assert.notEqual(next.rule.id, morning.rule.id);
  // Callers get their own modifiers; changing one run cannot alter the preset.
  next.rule.modifiers.bannedUpgrades.push("saw");
  assert.deepEqual(getDailyShift(new Date(2026, 8, 25)).rule.modifiers.bannedUpgrades.includes("saw"), false);
});

test("rules rotate through every preset without repeating on consecutive days", () => {
  const seen = new Set<string>(),
    seeds = new Set<number>();
  let previous = "";
  for (let day = 0; day < DAILY_RULES.length * 3; day++) {
    const shift = getDailyShift(new Date(2026, 11, 20 + day));
    assert.notEqual(shift.rule.id, previous, shift.key);
    previous = shift.rule.id;
    if (day < DAILY_RULES.length) seen.add(shift.rule.id);
    seeds.add(shift.seed);
    assert.ok(Number.isInteger(shift.seed) && shift.seed >= 0 && shift.seed < 2 ** 32);
  }
  assert.equal(seen.size, DAILY_RULES.length, "each preset appears within one cycle");
  assert.equal(seeds.size, DAILY_RULES.length * 3, "every date has its own seed");
});

test("presets are named, described and only use real upgrades", () => {
  assert.ok(DAILY_RULES.length >= 10);
  assert.equal(new Set(DAILY_RULES.map((r) => r.id)).size, DAILY_RULES.length);
  for (const rule of DAILY_RULES) {
    assert.ok(rule.name && rule.description.endsWith("."), rule.id);
    assert.ok(rule.art in UPGRADES, rule.id);
    const m = rule.modifiers;
    for (const id of [...m.bannedUpgrades, ...Object.keys(m.startingUpgrades)])
      assert.ok(id in UPGRADES, `${rule.id}: ${id}`);
    assert.ok(m.enemyHealth > 0 && m.enemySpeed > 0 && m.spawnRate > 0);
    const neutral =
      m.enemyHealth === 1 &&
      m.enemySpeed === 1 &&
      m.spawnRate === 1 &&
      m.eliteChance === 0 &&
      !m.bannedUpgrades.length &&
      !Object.keys(m.startingUpgrades).length;
    assert.equal(neutral, false, `${rule.id} changes the run`);
  }
});

test("date keys are local calendar days and survive month, year and leap boundaries", () => {
  assert.equal(dateKey(new Date(2027, 0, 1, 0, 0)), "2027-01-01");
  assert.equal(dayNumber("2027-01-01") - dayNumber("2026-12-31"), 1);
  assert.equal(dayNumber("2028-03-01") - dayNumber("2028-02-28"), 2);
  assert.equal(dayNumber("2026-11-02") - dayNumber("2026-10-31"), 2);
  assert.equal(isDateKey("2026-09-24"), true);
  for (const bad of ["2026-02-30", "2026-9-24", "24-09-2026", "", null, 20260924])
    assert.equal(isDateKey(bad), false, String(bad));
});

test("streaks grow on consecutive days, ignore repeats and reset after a missed day", () => {
  const d = empty();
  const first = recordDaily(d, "2026-09-24", 200);
  assert.deepEqual(first, { date: "2026-09-24", time: 200, best: 200, first: true, reward: 25, streak: 1 });
  const again = recordDaily(d, "2026-09-24", 320);
  assert.equal(again.first, false);
  assert.equal(again.reward, 0);
  assert.equal(again.best, 320);
  assert.equal(recordDaily(d, "2026-09-24", 90).best, 320, "best time keeps the record");
  assert.equal(recordDaily(d, "2026-09-25", 60).streak, 2);
  assert.equal(currentStreak(d, "2026-09-25"), 2);
  assert.equal(currentStreak(d, "2026-09-26"), 2, "alive until the next day ends");
  assert.equal(currentStreak(d, "2026-09-27"), 0, "a missed day breaks it");
  assert.equal(nextStreak(d, "2026-09-26"), 3);
  assert.equal(nextStreak(d, "2026-09-27"), 1);
  const reset = recordDaily(d, "2026-09-27", 30);
  assert.equal(reset.streak, 1);
  assert.equal(reset.reward, 25);
  assert.deepEqual(d, { date: "2026-09-27", best: 30, streak: 1, longest: 2, days: 3 });
  // A clock moved backwards starts over instead of locking rewards.
  assert.equal(recordDaily(d, "2026-09-20", 10).streak, 1);
});

test("the daily reward adds five parts per streak day, capped at seven days", () => {
  const d = empty();
  const rewards = [];
  for (let day = 1; day <= 10; day++)
    rewards.push(recordDaily(d, `2026-10-${String(day).padStart(2, "0")}`, 60).reward);
  assert.deepEqual(rewards, [25, 30, 35, 40, 45, 50, 55, 55, 55, 55]);
  assert.equal(d.longest, 10);
  assert.equal(dailyReward(0), 25);
});
