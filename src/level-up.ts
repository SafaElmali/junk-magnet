import { SPECIALIZATIONS } from "./specializations";
import { specializationCopy } from "./specialization-ui";
import { abilityImage } from "./ability-art";
import { t, upgradeName, localizedUpgradeDescription } from "./i18n";
import { UPGRADES, canBanish, type State } from "./simulation";

/** While banishing, build upgrades show the action and supplies stay locked. */
export function upgradeChoicesMarkup(s: State, banishing = false): string {
  if (s.specializationChoices.length) {
    return s.specializationChoices.map((id, index) => {
      const [name, description] = specializationCopy(id);
      return `<button type="button" class="upgrade-choice" data-specialization="${id}" data-choice="${index}"><span class="upgrade-icon">${abilityImage(SPECIALIZATIONS[id].weapon)}</span><span class="upgrade-text"><span class="upgrade-name-row"><strong>${name}</strong><span class="upgrade-rank">${upgradeName(SPECIALIZATIONS[id].weapon)}</span></span><span class="upgrade-description">${description}</span></span><kbd aria-hidden="true">${index + 1}</kbd></button>`;
    }).join("");
  }
  return s.choices
    .map((id, index) => {
      const rank = s.upgrades[id],
        max = UPGRADES[id].maxRank,
        permanent = Number.isFinite(max);
      const label = !permanent
        ? t(
            id === "overclock"
              ? "20-SECOND BOOST"
              : id === "repair"
                ? "INSTANT REPAIR"
                : "INSTANT REFILL",
          )
        : rank
          ? t("RANK {rank} → {next}", { rank, next: rank + 1 })
          : t("NEW ABILITY");
      const pips = permanent
        ? `<span class="upgrade-pips" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < rank ? "owned" : i === rank ? "next" : ""}"></i>`).join("")}</span>`
        : "";
      const banish = banishing
        ? canBanish(id)
          ? ` data-banish="target"`
          : ` data-banish="locked" aria-disabled="true"`
        : "";
      const tag =
        banishing && canBanish(id)
          ? `<span class="upgrade-banish-tag">${t("BANISH")}</span>`
          : "";
      return `<button type="button" class="upgrade-choice" data-upgrade="${id}" data-choice="${index}" data-new="${permanent && rank === 0}"${banish}><span class="upgrade-icon">${abilityImage(id)}${pips}</span><span class="upgrade-text"><span class="upgrade-name-row"><strong>${upgradeName(id)}</strong><span class="upgrade-rank">${label}</span></span><span class="upgrade-description">${localizedUpgradeDescription(s, id)}</span></span><kbd aria-hidden="true">${index + 1}</kbd>${tag}</button>`;
    })
    .join("");
}

const toolIcon = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const REROLL_ICON = toolIcon(
  '<path d="M19.5 9A8 8 0 0 0 5.2 7.2M4.5 15a8 8 0 0 0 14.3 1.8"/><path d="M5 3v4.5h4.5M19 21v-4.5h-4.5"/>',
);
const BANISH_ICON = toolIcon('<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>');

/** Solo level-up tools: redraw every card, or remove one build upgrade from this run. */
export function levelUpToolsMarkup(s: State, banishing = false): string {
  const canBanishNow = s.banishes > 0 && s.choices.some(canBanish);
  return `<button type="button" class="upgrade-tool" data-tool="reroll" aria-keyshortcuts="R" aria-label="${t("Reroll all choices · {count} left", { count: s.rerolls })}"${s.rerolls > 0 && !banishing ? "" : " disabled"}>${REROLL_ICON}<span>${t("REROLL")}</span><b aria-hidden="true">${s.rerolls}</b><kbd aria-hidden="true">R</kbd></button><button type="button" class="upgrade-tool" data-tool="banish" aria-keyshortcuts="X" aria-pressed="${banishing}" aria-label="${banishing ? t("Cancel banish") : t("Banish a choice · {count} left", { count: s.banishes })}"${canBanishNow || banishing ? "" : " disabled"}>${BANISH_ICON}<span>${t(banishing ? "CANCEL" : "BANISH")}</span><b aria-hidden="true">${s.banishes}</b><kbd aria-hidden="true">X</kbd></button>`;
}
