import { getLanguage, t } from "./i18n";
import { getProgress, ROBOTS, type Progress } from "./progression";
import { STAGES } from "./stages";
import {
  WORK_ORDER_GROUPS,
  workOrders,
  type WorkOrder,
  type WorkOrderGroup,
} from "./work-orders";
import { minutes, partsIcon } from "./workshop";
import "./work-orders.css";

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const ordersIcon = svg(
  '<path d="M9 3h6v4H9Z"/><path d="M9 5H5v16h14V5h-4"/><path d="m8.5 13.5 2.5 2.5 4.5-5"/>',
);
export const checkIcon = svg('<path d="m5 12 5 5 9-10"/>');
const previous = svg('<path d="m15 5-7 7 7 7"/>'),
  next = svg('<path d="m9 5 7 7-7 7"/>');
export const groupIcons: Record<WorkOrderGroup, string> = {
  survival: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
  combat: svg('<path d="M14.5 3.5 20 3l-.5 5.5L9 19l-4 1 1-4Z"/><path d="m4 14 6 6M16 8l-2-2"/>'),
  builds: svg('<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>'),
  explorer: svg('<path d="M3 8h18v13H3Z"/><path d="m3 8 4-5h10l4 5M9 8v5l3-2 3 2V8"/>'),
  robots: svg('<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V4m-3 17v-3m6 3v-3M9.5 13h.01m4.99 0h.01"/>'),
  challenges: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>'),
};
export const groupNames: Record<WorkOrderGroup, string> = {
  survival: "Survival",
  combat: "Combat",
  builds: "Builds",
  explorer: "Explorer",
  robots: "Robots",
  challenges: "Daily",
};
const number = (n: number) => n.toLocaleString(getLanguage());
export function orderTitle(o: WorkOrder): string {
  return t(o.title, {
    count: number(o.target),
    time: minutes(o.target),
    stage: o.stage ? t(STAGES[o.stage].name) : "",
    robot: ROBOTS.find((robot) => robot.id === o.robot)?.name ?? "",
  });
}
/** "7:42 / 10:00" or "3,120 / 10,000"; one-step goals have no count. */
export function orderProgressText(o: WorkOrder, p: Progress): string {
  if (o.target <= 1) return "";
  const value = Math.min(o.value(p), o.target);
  return o.measure === "time"
    ? `${minutes(value)} / ${minutes(o.target)}`
    : `${number(value)} / ${number(o.target)}`;
}
const orders = () => workOrders(ROBOTS);
/** Cards per page, like the ability library: a full group on tall desktops. */
const pageLayout = () => {
  const wide = innerWidth > 700;
  if (innerHeight <= 420) return { columns: wide ? 2 : 1, rows: 2 };
  if (wide) return { columns: 2, rows: innerHeight > 720 ? 4 : 3 };
  return { columns: 1, rows: innerHeight >= 800 ? 6 : innerHeight >= 660 ? 4 : 3 };
};
export function setupWorkOrders(host: HTMLElement) {
  let group: WorkOrderGroup = "survival";
  let sheet = 0;
  let fresh: string[] = [];
  let layout = "";
  function render() {
    layout = JSON.stringify(pageLayout());
    const p = getProgress(),
      all = orders(),
      { columns, rows } = pageLayout(),
      size = columns * rows,
      list = all.filter((o) => o.group === group),
      pages = Math.max(1, Math.ceil(list.length / size));
    sheet = Math.min(sheet, pages - 1);
    const done = all.filter((o) => p.orders.includes(o.id));
    const tabs = WORK_ORDER_GROUPS.map((id) => {
      const members = all.filter((o) => o.group === id),
        complete = members.filter((o) => p.orders.includes(o.id)).length,
        news = members.some((o) => fresh.includes(o.id));
      const label = `${t(groupNames[id])} · ${complete} / ${members.length}`;
      return `<button data-order-group="${id}" aria-pressed="${group === id}" aria-label="${label}" title="${label}"${news ? ' class="has-new"' : ""}><span class="order-group-icon">${groupIcons[id]}</span><span class="order-group-name">${t(groupNames[id])}</span><small aria-hidden="true">${complete}/${members.length}</small></button>`;
    }).join("");
    const cards = list
      .slice(sheet * size, (sheet + 1) * size)
      .map((o) => {
        const complete = p.orders.includes(o.id),
          ready = !complete && o.value(p) >= o.target,
          progress = Math.min(1, o.value(p) / o.target),
          count = orderProgressText(o, p),
          state = complete ? "is-done" : ready ? "is-ready" : "is-open";
        const status = complete
          ? t("Complete")
          : ready
            ? t("Finish a shift to collect")
            : count;
        return `<li class="order-card ${state}${fresh.includes(o.id) ? " is-new" : ""}"><span class="order-mark">${complete ? checkIcon : groupIcons[o.group]}</span><div class="order-copy"><strong>${orderTitle(o)}</strong>${
          complete || o.target <= 1
            ? ""
            : `<span class="order-meter" role="progressbar" aria-label="${orderTitle(o)}" aria-valuemin="0" aria-valuemax="${o.target}" aria-valuenow="${Math.min(o.value(p), o.target)}"${count ? ` aria-valuetext="${count}"` : ""}><i style="--progress:${(progress * 100).toFixed(1)}%"></i></span>`
        }${status ? `<span class="order-status">${status}</span>` : ""}</div><span class="order-reward">${fresh.includes(o.id) ? `<em>${t("NEW")}</em>` : ""}${partsIcon}<span aria-hidden="true">+${o.reward}</span><span class="meta-sr">${t("+{parts} parts", { parts: o.reward })}</span></span></li>`;
      })
      .join("");
    const earned = done.reduce((sum, o) => sum + o.reward, 0);
    host.innerHTML = `<div class="order-tabs" role="group" aria-label="${t("Work order groups")}">${tabs}</div>
      <p class="order-summary">${t("{done} / {total} complete · {parts} parts earned", { done: done.length, total: all.length, parts: number(earned) })}</p>
      <ul class="order-list" style="--order-columns:${columns};--order-rows:${rows}" aria-label="${t(groupNames[group])}">${cards}</ul>
      <nav class="ability-pagination order-pages${pages > 1 ? "" : " is-single"}" aria-label="${t("Work order pages")}"><button data-order-page="-1" aria-label="${t("Previous page")}" ${sheet === 0 ? "disabled" : ""}>${previous}</button><span aria-live="polite">${sheet + 1} / ${pages}</span><button data-order-page="1" aria-label="${t("Next page")}" ${sheet >= pages - 1 ? "disabled" : ""}>${next}</button></nav>`;
  }
  host.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    let focus: string[] = [];
    if (button.dataset.orderGroup) {
      group = button.dataset.orderGroup as WorkOrderGroup;
      sheet = 0;
      focus = [`[data-order-group="${group}"]`];
    }
    if (button.dataset.orderPage) {
      sheet = Math.max(0, sheet + Number(button.dataset.orderPage));
      focus = [
        `[data-order-page="${button.dataset.orderPage}"]:not(:disabled)`,
        "[data-order-page]:not(:disabled)",
      ];
    }
    render();
    for (const selector of focus) {
      const target = host.querySelector<HTMLElement>(selector);
      if (!target) continue;
      target.focus({ preventScroll: true });
      break;
    }
  });
  window.addEventListener("resize", () => {
    const nextLayout = JSON.stringify(pageLayout());
    if (nextLayout === layout || host.classList.contains("hidden")) return;
    const focused = host.contains(document.activeElement);
    sheet = 0;
    render();
    if (focused)
      host.querySelector<HTMLElement>(`[data-order-group="${group}"]`)?.focus({ preventScroll: true });
  });
  return {
    refresh: render,
    /** Opens on the group of the first new completion, else the goal closest to done. */
    enter(newIds: string[]) {
      fresh = newIds;
      const p = getProgress(),
        all = orders();
      const focus =
        all.find((o) => o.id === newIds[0]) ??
        all
          .filter((o) => !p.orders.includes(o.id))
          .sort((a, b) => b.value(p) / b.target - a.value(p) / a.target)[0];
      group = focus?.group ?? "survival";
      const list = all.filter((o) => o.group === group),
        { columns, rows } = pageLayout();
      sheet = focus ? Math.floor(list.indexOf(focus) / (columns * rows)) : 0;
      render();
    },
  };
}
/** Completed orders not yet shown on the Work Orders page. */
export const newOrderCount = (p: Progress) => p.orders.length - p.ordersSeen;
