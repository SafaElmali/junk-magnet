import { getLanguage, t } from "./i18n";
import { track } from "./analytics";
import { abilityImage } from "./ability-art";
import { getProgress, getRunConfig, type RunConfig } from "./progression";
import {
  currentStreak,
  dailyReward,
  dailyShiftFor,
  getDailyShift,
  nextStreak,
  DAILY_REWARD,
  DAILY_STREAK_CAP,
  DAILY_STREAK_REWARD,
} from "./daily-shift";
import { minutes, partsIcon } from "./workshop";
import "./daily-shift.css";

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const calendarIcon = svg(
  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4m-8 7 2.5 2.5L16 13"/>',
);
export const streakIcon = svg(
  '<path d="M12 3c.6 3.2 5 5.4 5 10.2A5 5 0 0 1 7 13.2c0-2 .9-3.4 2-4.4.1 1.8.9 3 2.1 3.2C11 9 10.6 6 12 3Z"/>',
);
const checkIcon = svg('<path d="m5 12 5 5 9-10"/>');
const playIcon = svg('<path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none"/>');

/** Today's shift and the saved streak, as the home entry and the Daily Shift page show them. */
export function dailyStatus(now = new Date()) {
  const shift = getDailyShift(now),
    daily = getProgress().daily,
    done = daily.date === shift.key;
  return {
    shift,
    done,
    best: done ? daily.best : 0,
    streak: currentStreak(daily, shift.key),
    /** Parts the first finished run today pays. */
    reward: dailyReward(nextStreak(daily, shift.key)),
  };
}
/** A Daily Shift run: the saved loadout with today's seed and rule, on the Scrapyard. */
export function dailyRunConfig(now = new Date()): RunConfig {
  const { key, seed, rule } = getDailyShift(now);
  return { ...getRunConfig(), stage: "yard", seed, modifiers: rule.modifiers, daily: key };
}
export function trackDailyStart(config: RunConfig) {
  if (!config.daily) return;
  const daily = getProgress().daily;
  track("daily_shift_started", {
    date: config.daily,
    rule_id: dailyShiftFor(config.daily).rule.id,
    streak: currentStreak(daily, config.daily),
    completed_today: daily.date === config.daily,
  });
}
const clock = (now: Date) => {
  const left = Math.max(
    60_000,
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
      now.getTime(),
  );
  const total = Math.ceil(left / 60_000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
/** Home entry: rule name with today's best or reward, and the live streak. */
export function renderDailyEntry(button: HTMLElement) {
  const s = dailyStatus();
  const detail = s.done
    ? t("Best {time}", { time: minutes(s.best) })
    : t("+{parts} parts", { parts: s.reward });
  button.querySelector("[data-daily-detail]")!.textContent =
    `${t(s.shift.rule.name)} · ${detail}`;
  const chip = button.querySelector<HTMLElement>("[data-daily-streak]")!;
  chip.classList.toggle("hidden", !s.streak && !s.done);
  chip.classList.toggle("is-done", s.done);
  chip.innerHTML = `${s.done ? checkIcon : streakIcon}<span>${s.streak || ""}</span>`;
  button.setAttribute(
    "aria-label",
    [
      t("DAILY SHIFT"),
      t(s.shift.rule.name),
      detail,
      s.streak ? t("{count}-day streak", { count: s.streak }) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );
}
export function dailyPageMarkup(resumable: boolean) {
  const now = new Date(),
    s = dailyStatus(now);
  const date = new Intl.DateTimeFormat(getLanguage(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  return `<article class="daily-rule" aria-labelledby="daily-rule-name">
      <div class="daily-art" aria-hidden="true">${abilityImage(s.shift.rule.art)}</div>
      <div class="daily-copy"><span class="daily-date">${date}</span><h4 id="daily-rule-name">${t(s.shift.rule.name)}</h4><p>${t(s.shift.rule.description)}</p></div>
    </article>
    <dl class="daily-stats">
      <div><dt>${t("Today’s best")}</dt><dd>${s.done ? minutes(s.best) : "–"}</dd></div>
      <div class="daily-streak${s.streak ? " is-live" : ""}"><dt>${t("Streak")}</dt><dd>${streakIcon}<span>${s.streak}</span></dd></div>
      <div><dt>${t("Reward")}</dt><dd>${s.done ? `${checkIcon}<span class="daily-collected">${t("Collected")}</span>` : `${partsIcon}<span>+${s.reward}</span>`}</dd></div>
    </dl>
    <button id="daily-start" class="menu-button menu-play daily-start"><span>${t("START DAILY SHIFT")}</span>${playIcon}</button>
    <p class="daily-note">${
      resumable
        ? t("Starting ends your paused run.")
        : s.done
          ? t("Come back tomorrow to keep your streak. Next shift in {time}.", { time: clock(now) })
          : t("First run finished each day: +{base} parts, +{bonus} per streak day (up to {days}).", {
              base: DAILY_REWARD,
              bonus: DAILY_STREAK_REWARD,
              days: DAILY_STREAK_CAP,
            })
    }</p>`;
}
