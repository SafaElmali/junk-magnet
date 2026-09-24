import { t, upgradeName } from "./i18n";
import { track } from "./analytics";
import {
  ROBOTS,
  getProgress,
  selectRobot,
  unlockRobot,
  buyUpgrade,
  upgradeCost,
  PERMANENT_UPGRADES,
  WORKSHOP_UPGRADES,
  type RobotId,
  type PermanentUpgrade,
} from "./progression";
import type { UpgradeId } from "./simulation";
import { abilityImage } from "./ability-art";
import "./workshop.css";
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const workshopIcon = svg(
  '<path d="m14 4 4-2-1 5-4 2-6 12-4-2 7-11V4Z"/>',
);
const previous = svg('<path d="m15 5-7 7 7 7"/>'),
  next = svg('<path d="m9 5 7 7-7 7"/>');
export const partsIcon = svg(
  '<path d="M12 3.5 19.4 7.8v8.4L12 20.5 4.6 16.2V7.8Z"/><circle cx="12" cy="12" r="3"/>',
);
const checkIcon = svg('<path d="m5 12 5 5 9-10"/>');
// Workshop upgrades reuse the closest Blender ability renders.
export const WORKSHOP_COPY: Record<
  PermanentUpgrade,
  { name: string; description: string; art: UpgradeId }
> = {
  hull: { name: "Reinforced hull", description: "−1 contact damage per rank.", art: "armor" },
  magnet: { name: "Magnet tuning", description: "+0.35 m pickup range per rank.", art: "magnet" },
  rerolls: { name: "Spare parts bin", description: "+1 level-up reroll per run, per rank.", art: "refill" },
  banishes: { name: "Scrap filter", description: "+1 banish per rank: drop an upgrade for the rest of the run.", art: "burst" },
  revive: { name: "Backup battery", description: "Once per run, revive at half health.", art: "repair" },
  xp: { name: "Energy condenser", description: "+5% XP per rank.", art: "lightning" },
  scrap: { name: "Preloaded orbit", description: "Start each run with +4 scrap per rank.", art: "saw" },
  salvage: { name: "Salvage license", description: "+10% parts per rank.", art: "drone_collector" },
};
/** Upgrade rows per page; all eight fit on tall desktop screens. */
const upgradeGrid = () => {
  const wide = innerWidth > 700;
  return {
    columns: wide ? 2 : 1,
    rows:
      innerHeight <= 420 || (innerWidth <= 360 && innerHeight < 640)
        ? 2
        : innerHeight > 640 && (wide || innerHeight >= 700)
          ? 4
          : 3,
  };
};
const lock = svg(
  '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
);
export function robotPortrait(id: RobotId, locked = false): string {
  return `<div class="workshop-stage" data-robot="${id}"><img class="workshop-robot" src="${import.meta.env.BASE_URL}robots/${id}.png" width="768" height="768" alt="" decoding="async" draggable="false" />${locked ? `<span class="workshop-lock">${lock}</span>` : ""}</div>`;
}
const rankMarks = (rank: number, max: number) =>
  `<span class="workshop-ranks" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < rank ? "is-filled" : ""}"></i>`).join("")}</span>`;
export const minutes = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
function upgradesMarkup(sheet: number) {
  const progress = getProgress(),
    { columns, rows } = upgradeGrid(),
    size = columns * rows,
    pages = Math.ceil(PERMANENT_UPGRADES.length / size),
    page = Math.min(sheet, pages - 1);
  const cards = PERMANENT_UPGRADES.slice(page * size, (page + 1) * size)
    .map((id) => {
      const rank = progress.upgrades[id],
        max = WORKSHOP_UPGRADES[id].length,
        cost = upgradeCost(progress, id),
        copy = WORKSHOP_COPY[id];
      const label =
        cost === undefined
          ? t("MAX RANK")
          : t("Upgrade · {cost} parts", { cost });
      return `<section class="workshop-upgrade${rank === max ? " is-maxed" : ""}" aria-labelledby="upgrade-${id}"><span class="workshop-upgrade-art">${abilityImage(copy.art)}</span><div class="workshop-upgrade-heading"><h4 id="upgrade-${id}">${t(copy.name)}</h4><div class="workshop-rank">${rankMarks(rank, max)}<span>${t("Rank {rank} / {max}", { rank, max })}</span></div></div><p>${t(copy.description)}</p><button class="workshop-buy" data-permanent-upgrade="${id}" aria-label="${label}" aria-describedby="upgrade-${id}" ${cost === undefined || progress.parts < cost ? "disabled" : ""}>${cost === undefined ? checkIcon : `${partsIcon}<span>${cost}</span>`}</button></section>`;
    })
    .join("");
  return `<div class="workshop-upgrades" style="--upgrade-columns:${columns};--upgrade-rows:${rows}">${cards}</div>${pages > 1 ? `<nav class="ability-pagination workshop-pages" aria-label="${t("Upgrade pages")}"><button data-upgrade-page="-1" aria-label="${t("Previous page")}" ${page === 0 ? "disabled" : ""}>${previous}</button><span aria-live="polite">${page + 1} / ${pages}</span><button data-upgrade-page="1" aria-label="${t("Next page")}" ${page === pages - 1 ? "disabled" : ""}>${next}</button></nav>` : ""}`;
}
export function setupWorkshop(host: HTMLElement, changed: () => void) {
  let tab: "robots" | "upgrades" = "robots";
  let index = ROBOTS.findIndex((r) => r.id === getProgress().selectedRobot);
  let resumable = false;
  let sheet = 0;
  let layout = "";
  // Page size follows the viewport; a rotation restarts at the first page.
  window.addEventListener("resize", () => {
    const next = JSON.stringify(upgradeGrid());
    if (next === layout) return;
    layout = next;
    sheet = 0;
    if (tab !== "upgrades" || host.classList.contains("hidden")) return;
    const focused = host.contains(document.activeElement);
    render();
    if (focused)
      host
        .querySelector<HTMLElement>('[data-workshop-tab="upgrades"]')
        ?.focus({ preventScroll: true });
  });
  function render() {
    layout = JSON.stringify(upgradeGrid());
    host.dataset.tab = tab;
    const progress = getProgress(),
      robot = ROBOTS[index],
      unlocked = progress.unlockedRobots.includes(robot.id),
      selected = progress.selectedRobot === robot.id;
    host.innerHTML = `<div class="workshop-top"><div class="workshop-tabs" role="group" aria-label="${t("Workshop sections")}"><button data-workshop-tab="robots" aria-pressed="${tab === "robots"}">${t("Robots")}</button><button data-workshop-tab="upgrades" aria-pressed="${tab === "upgrades"}">${t("Upgrades")}</button></div><div class="workshop-wallet"><strong>${progress.parts}</strong><span>${t("Parts")}</span></div></div>
      ${
        tab === "robots"
          ? `<section class="workshop-machine${unlocked ? "" : " is-locked"}" aria-label="${robot.name}"><div class="workshop-portrait"><button data-robot-step="-1" aria-label="${t("Previous robot")}">${previous}</button>${robotPortrait(robot.id, !unlocked)}<button data-robot-step="1" aria-label="${t("Next robot")}">${next}</button></div><div class="workshop-machine-copy"><span class="workshop-kicker">${index + 1} / ${ROBOTS.length} · ${t(unlocked ? "Unlocked" : "Locked")}</span><h4>${robot.name}</h4><p>${t(robot.description)}</p><div class="workshop-weapon"><span>${t("STARTING WEAPON")}</span><strong>${upgradeName(robot.startingWeapon)}</strong></div>${unlocked || progress.parts >= robot.cost ? "" : `<div class="workshop-progress" role="progressbar" aria-label="${t("Parts toward unlock")}" aria-valuemin="0" aria-valuemax="${robot.cost}" aria-valuenow="${progress.parts}"><i style="--progress: ${(progress.parts / robot.cost) * 100}%"></i><span aria-hidden="true">${progress.parts} / ${robot.cost}</span></div>`}<button class="workshop-buy" data-robot-action="${unlocked ? "select" : "unlock"}" ${selected || (!unlocked && progress.parts < robot.cost) ? "disabled" : ""}>${selected ? t("Selected") : unlocked ? t("Select robot") : t("Unlock · {cost} parts", { cost: robot.cost })}</button></div></section>`
          : upgradesMarkup(sheet)
      }
      <div class="workshop-footer ${resumable ? "is-resumable" : ""}"><p>${t(resumable ? "Changes apply to your next run." : "Earn parts by surviving, defeating bosses and finding caches.")}</p><div><span>${t("Best")}: ${minutes(progress.bestTime)} · ${progress.bestKills} ${t("Kills")}</span><span>${progress.completedRuns} ${t("Runs")}</span></div></div>`;
  }
  host.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || button.disabled) return;
    // Candidates in priority order; the first one still enabled after rendering gets focus.
    let focus: string[] = [];
    if (button.dataset.workshopTab) {
      tab = button.dataset.workshopTab as typeof tab;
      focus = [`[data-workshop-tab="${tab}"]`];
    }
    if (button.dataset.robotStep) {
      index =
        (index + Number(button.dataset.robotStep) + ROBOTS.length) %
        ROBOTS.length;
      focus = [`[data-robot-step="${button.dataset.robotStep}"]`];
    }
    if (button.dataset.robotAction) {
      const robot = ROBOTS[index];
      if (button.dataset.robotAction === "unlock") {
        if (unlockRobot(robot.id))
          track("robot_unlocked", {
            robot_id: robot.id,
            cost_parts: robot.cost,
          });
      } else if (selectRobot(robot.id))
        track("robot_selected", { robot_id: robot.id });
      changed();
      focus = ["[data-robot-action]:not(:disabled)", '[data-robot-step="1"]'];
    }
    if (button.dataset.upgradePage) {
      sheet = Math.max(0, sheet + Number(button.dataset.upgradePage));
      focus = [
        `[data-upgrade-page="${button.dataset.upgradePage}"]:not(:disabled)`,
        "[data-upgrade-page]:not(:disabled)",
      ];
    }
    if (button.dataset.permanentUpgrade) {
      const id = button.dataset.permanentUpgrade as PermanentUpgrade;
      const rank = getProgress().upgrades[id],
        cost = upgradeCost(getProgress(), id);
      if (buyUpgrade(id) && cost !== undefined)
        track("workshop_upgrade_purchased", {
          upgrade_id: id,
          rank: rank + 1,
          cost_parts: cost,
        });
      changed();
      focus = [
        `[data-permanent-upgrade="${id}"]:not(:disabled)`,
        '[data-workshop-tab="upgrades"]',
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
  return {
    refresh: render,
    showRobots() {
      tab = "robots";
    },
    enter(canResume: boolean) {
      resumable = canResume;
      index = ROBOTS.findIndex((r) => r.id === getProgress().selectedRobot);
      render();
    },
  };
}
