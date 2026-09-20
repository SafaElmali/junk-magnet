import { SPECIALIZATIONS } from "./specializations";
import { specializationCopy } from "./specialization-ui";
import { abilityImage } from "./ability-art";
import { t, upgradeName, localizedUpgradeDescription } from "./i18n";
import { UPGRADES, type State } from "./simulation";

export function upgradeChoicesMarkup(s: State): string {
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
      return `<button type="button" class="upgrade-choice" data-upgrade="${id}" data-choice="${index}" data-new="${permanent && rank === 0}"><span class="upgrade-icon">${abilityImage(id)}${pips}</span><span class="upgrade-text"><span class="upgrade-name-row"><strong>${upgradeName(id)}</strong><span class="upgrade-rank">${label}</span></span><span class="upgrade-description">${localizedUpgradeDescription(s, id)}</span></span><kbd aria-hidden="true">${index + 1}</kbd></button>`;
    })
    .join("");
}
