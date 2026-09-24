import { t } from "./i18n";
import { track } from "./analytics";
import {
  canAffordWorkshop,
  getProgress,
  upgradeCost,
  PERMANENT_UPGRADES,
  ROBOTS,
  type Progress,
  type RunReceipt,
} from "./progression";
import { STAGES } from "./stages";
import { dailyShiftFor } from "./daily-shift";
import { nextWorkOrder, workOrders, type WorkOrder } from "./work-orders";
import { checkIcon, ordersIcon, orderProgressText, orderTitle } from "./work-orders-view";
import { calendarIcon, dailyStatus } from "./daily-shift-view";
import { minutes, partsIcon, workshopIcon, WORKSHOP_COPY } from "./workshop";
import "./result-orders.css";

type Line = { kind: string; icon: string; text: string; reward?: number };
const targetIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>';
const stageIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z"/></svg>';
let tracked = "";

function trackOnce(receipt: RunReceipt, done: { order: WorkOrder; reward: number }[], p: Progress) {
  if (tracked === receipt.runId) return;
  tracked = receipt.runId;
  for (const { order, reward } of done)
    track("work_order_completed", {
      order_id: order.id,
      group: order.group,
      reward_parts: reward,
      completed_count: p.orders.length,
      run_id: receipt.runId,
    });
  const daily = receipt.daily;
  if (daily)
    track("daily_shift_completed", {
      date: daily.date,
      rule_id: dailyShiftFor(daily.date).rule.id,
      duration_seconds: daily.time,
      best_seconds: daily.best,
      first_today: daily.first,
      reward_parts: daily.reward,
      streak: daily.streak,
      run_id: receipt.runId,
    });
}
// Tomorrow's finish extends the streak by one day.
const comeBack = (streak: number) =>
  t("Come back tomorrow for day {count}", { count: streak + 1 });
/** The Daily Shift status after this run: done today, or today's rule and reward. */
function dailyLine(receipt: RunReceipt): Line {
  const today = dailyStatus(),
    run = receipt.daily;
  if (run?.first)
    return { kind: "daily", icon: calendarIcon, text: `${t("Daily Shift done")} · ${comeBack(run.streak)}`, reward: run.reward };
  if (run) return { kind: "daily", icon: calendarIcon, text: `${t("Daily best {time}", { time: minutes(run.best) })} · ${comeBack(run.streak)}` };
  if (today.done) return { kind: "daily", icon: calendarIcon, text: `${t("Daily Shift done")} · ${comeBack(today.streak)}` };
  return { kind: "daily", icon: calendarIcon, text: t("Today’s Daily Shift: {rule}", { rule: t(today.shift.rule.name) }), reward: today.reward };
}
function nextOrderLine(p: Progress): Line | null {
  const o = nextWorkOrder(p, ROBOTS);
  if (!o) return null;
  const value = Math.min(o.value(p), o.target);
  const progress =
    o.target <= 1 || !value
      ? ""
      : o.measure === "total"
        ? orderProgressText(o, p)
        : t("best {value}", { value: o.measure === "time" ? minutes(value) : value });
  return {
    kind: "next",
    icon: targetIcon,
    text: [t("Next: {order}", { order: orderTitle(o) }), progress].filter(Boolean).join(" · "),
    reward: o.reward,
  };
}
/** The cheapest thing the bank can almost buy, or a nudge when something is affordable. */
function workshopLine(p: Progress): Line | null {
  if (canAffordWorkshop(p))
    return { kind: "workshop", icon: workshopIcon, text: t("Upgrade available in the workshop") };
  const goals = [
    ...ROBOTS.filter((r) => !p.unlockedRobots.includes(r.id)).map((r) => ({
      cost: r.cost,
      text: (count: number) => t("{count} parts to unlock {robot}", { count, robot: r.name }),
    })),
    ...PERMANENT_UPGRADES.flatMap((id) => {
      const cost = upgradeCost(p, id);
      return cost === undefined
        ? []
        : [{ cost, text: (count: number) => t("{count} parts to {upgrade}", { count, upgrade: t(WORKSHOP_COPY[id].name) }) }];
    }),
  ].sort((a, b) => a.cost - b.cost);
  return goals[0]
    ? { kind: "workshop", icon: workshopIcon, text: goals[0].text(goals[0].cost - p.parts) }
    : null;
}
const lineMarkup = (line: Line, rank: number) =>
  `<li class="result-line is-${line.kind}" data-rank="${rank}"><span class="result-line-icon">${line.icon}</span><span class="result-line-text">${line.text}</span>${
    line.reward
      ? `<b class="result-line-reward">${partsIcon}<span>+${line.reward}</span><span class="meta-sr"> ${t("Parts")}</span></b>`
      : ""
  }</li>`;
/**
 * Completed work orders, then up to three reasons to play again: the Daily Shift,
 * the nearest work order and the next workshop goal. Small screens keep fewer lines.
 */
export function renderResultOrders(
  host: HTMLElement,
  receipt: RunReceipt | null,
) {
  host.classList.toggle("hidden", !receipt);
  if (!receipt) {
    host.innerHTML = "";
    return;
  }
  const p = getProgress(),
    all = workOrders(ROBOTS);
  const done = receipt.orders.flatMap(({ id, reward }) => {
    const order = all.find((o) => o.id === id);
    return order ? [{ order, reward }] : [];
  });
  trackOnce(receipt, done, p);
  const completed: Line[] =
    done.length > 3
      ? [
          ...done.slice(0, 2).map(({ order, reward }) => ({ kind: "done", icon: checkIcon, text: orderTitle(order), reward })),
          {
            kind: "done",
            icon: ordersIcon,
            text: t("+{count} more work orders", { count: done.length - 2 }),
            reward: done.slice(2).reduce((sum, d) => sum + d.reward, 0),
          },
        ]
      : done.map(({ order, reward }) => ({ kind: "done", icon: checkIcon, text: orderTitle(order), reward }));
  // Compact layouts show one summary row instead of each order.
  const summary: Line | null =
    done.length > 1
      ? {
          kind: "summary",
          icon: checkIcon,
          text: t("{count} work orders complete", { count: done.length }),
          reward: done.reduce((sum, d) => sum + d.reward, 0),
        }
      : null;
  const goals = [
    receipt.unlockedStage
      ? { kind: "stage", icon: stageIcon, text: t("New stage unlocked: {stage}", { stage: t(STAGES[receipt.unlockedStage].name) }) }
      : null,
    dailyLine(receipt),
    nextOrderLine(p),
    workshopLine(p),
  ]
    .filter((line): line is Line => line !== null)
    .slice(0, 3);
  host.innerHTML = `${
    done.length
      ? `<ul class="result-done${summary ? " has-summary" : ""}" aria-label="${t("Work orders complete")}">${completed.map((line, i) => lineMarkup(line, i + 1)).join("")}${summary ? lineMarkup(summary, 0) : ""}</ul>`
      : ""
  }<ul class="result-goals" aria-label="${t("Next goals")}">${goals.map((line, i) => lineMarkup(line, i + 1)).join("")}</ul>`;
}
