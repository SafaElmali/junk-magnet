import { t, upgradeName } from "./i18n";
import { track } from "./analytics";
import {
  ROBOTS,
  getProgress,
  selectRobot,
  unlockRobot,
  buyUpgrade,
  UPGRADE_PRICES,
  type RobotId,
  type PermanentUpgrade,
} from "./progression";
import { abilityImage } from "./ability-art";
import "./workshop.css";
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const workshopIcon = svg(
  '<path d="m14 4 4-2-1 5-4 2-6 12-4-2 7-11V4Z"/>',
);
const previous = svg('<path d="m15 5-7 7 7 7"/>'),
  next = svg('<path d="m9 5 7 7-7 7"/>');
// Workshop upgrades reuse the matching Blender ability renders.
const upgradeArt = { hull: "armor", magnet: "magnet" } as const;
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
export function setupWorkshop(host: HTMLElement, changed: () => void) {
  let tab: "robots" | "upgrades" = "robots";
  let index = ROBOTS.findIndex((r) => r.id === getProgress().selectedRobot);
  let resumable = false;
  function render() {
    const progress = getProgress(),
      robot = ROBOTS[index],
      unlocked = progress.unlockedRobots.includes(robot.id),
      selected = progress.selectedRobot === robot.id;
    host.innerHTML = `<div class="workshop-top"><div class="workshop-tabs" role="group" aria-label="${t("Workshop sections")}"><button data-workshop-tab="robots" aria-pressed="${tab === "robots"}">${t("Robots")}</button><button data-workshop-tab="upgrades" aria-pressed="${tab === "upgrades"}">${t("Upgrades")}</button></div><div class="workshop-wallet"><strong>${progress.parts}</strong><span>${t("Parts")}</span></div></div>
      ${
        tab === "robots"
          ? `<section class="workshop-machine${unlocked ? "" : " is-locked"}" aria-label="${robot.name}"><div class="workshop-portrait"><button data-robot-step="-1" aria-label="${t("Previous robot")}">${previous}</button>${robotPortrait(robot.id, !unlocked)}<button data-robot-step="1" aria-label="${t("Next robot")}">${next}</button></div><div class="workshop-machine-copy"><span class="workshop-kicker">${index + 1} / ${ROBOTS.length} · ${t(unlocked ? "Unlocked" : "Locked")}</span><h4>${robot.name}</h4><p>${t(robot.description)}</p><div class="workshop-weapon"><span>${t("STARTING WEAPON")}</span><strong>${upgradeName(robot.startingWeapon)}</strong></div>${unlocked || progress.parts >= robot.cost ? "" : `<div class="workshop-progress" role="progressbar" aria-label="${t("Parts toward unlock")}" aria-valuemin="0" aria-valuemax="${robot.cost}" aria-valuenow="${progress.parts}"><i style="--progress: ${(progress.parts / robot.cost) * 100}%"></i><span aria-hidden="true">${progress.parts} / ${robot.cost}</span></div>`}<button class="workshop-buy" data-robot-action="${unlocked ? "select" : "unlock"}" ${selected || (!unlocked && progress.parts < robot.cost) ? "disabled" : ""}>${selected ? t("Selected") : unlocked ? t("Select robot") : t("Unlock · {cost} parts", { cost: robot.cost })}</button></div></section>`
          : `<div class="workshop-upgrades">${(["hull", "magnet"] as const)
              .map((id) => {
                const rank = progress.upgrades[id],
                  cost = UPGRADE_PRICES[rank];
                return `<section class="workshop-upgrade"><div class="workshop-upgrade-heading"><span class="workshop-upgrade-art">${abilityImage(upgradeArt[id])}</span><div><h4>${t(id === "hull" ? "Reinforced hull" : "Magnet tuning")}</h4><span>${t("Rank {rank} / 3", { rank })}</span>${rankMarks(rank, UPGRADE_PRICES.length)}</div></div><p>${t(id === "hull" ? "−1 contact damage per rank." : "+0.35 m pickup range per rank.")}</p><button class="workshop-buy" data-permanent-upgrade="${id}" ${cost === undefined || progress.parts < cost ? "disabled" : ""}>${cost === undefined ? t("MAX RANK") : t("Upgrade · {cost} parts", { cost })}</button></section>`;
              })
              .join("")}</div>`
      }
      <div class="workshop-footer ${resumable ? "is-resumable" : ""}"><p>${t(resumable ? "Changes apply to your next run." : "Earn parts by surviving, defeating bosses and finding caches.")}</p><div><span>${t("Best")}: ${minutes(progress.bestTime)} · ${progress.bestKills} ${t("Kills")}</span><span>${progress.completedRuns} ${t("Runs")}</span></div></div>`;
  }
  host.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || button.disabled) return;
    let focusSelector = "";
    if (button.dataset.workshopTab) {
      tab = button.dataset.workshopTab as typeof tab;
      focusSelector = `[data-workshop-tab="${tab}"]`;
    }
    if (button.dataset.robotStep) {
      index =
        (index + Number(button.dataset.robotStep) + ROBOTS.length) %
        ROBOTS.length;
      focusSelector = `[data-robot-step="${button.dataset.robotStep}"]`;
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
      focusSelector =
        '[data-robot-action]:not(:disabled), [data-robot-step="1"]';
    }
    if (button.dataset.permanentUpgrade) {
      const id = button.dataset.permanentUpgrade as PermanentUpgrade;
      const rank = getProgress().upgrades[id];
      if (buyUpgrade(id))
        track("workshop_upgrade_purchased", {
          upgrade_id: id,
          rank: rank + 1,
          cost_parts: UPGRADE_PRICES[rank],
        });
      changed();
      focusSelector = `[data-permanent-upgrade="${button.dataset.permanentUpgrade}"]:not(:disabled), [data-workshop-tab="upgrades"]`;
    }
    render();
    host
      .querySelector<HTMLElement>(focusSelector)
      ?.focus({ preventScroll: true });
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
