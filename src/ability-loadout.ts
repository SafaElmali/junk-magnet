import { abilityImage } from "./ability-art";
import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { t, upgradeName } from "./i18n";
import { UPGRADES, type State, type UpgradeId } from "./simulation";

export function abilityLoadoutMarkup(state: State): string {
  return (Object.keys(state.upgrades) as UpgradeId[])
    .filter((id) => Number.isFinite(UPGRADES[id].maxRank) && state.upgrades[id] > 0)
    .map((id) => {
      const rank = state.upgrades[id];
      const maxRank = UPGRADES[id].maxRank;
      const evolution = (Object.keys(EVOLUTIONS) as EvolutionId[]).find(
        (key) => state.evolutions[key] && EVOLUTIONS[key].weapon === id,
      );
      const name = evolution ? t(EVOLUTIONS[evolution].name) : upgradeName(id);
      const label = t("{name}, rank {rank}", { name, rank });
      const pips = Array.from({ length: maxRank }, (_, index) =>
        `<i${index < rank ? ' class="is-filled"' : ""}></i>`,
      ).join("");
      return `<button type="button" data-owned-ability="${id}" aria-haspopup="dialog" aria-controls="build-inspector" class="ability-chip${evolution ? " is-evolved" : ""}" title="${label}" aria-label="${label}"><span class="ability-chip-art" aria-hidden="true">${abilityImage(id)}<b>${rank}</b>${evolution ? '<span class="ability-chip-evolution">✦</span>' : ""}</span><span class="ability-chip-ranks" aria-hidden="true">${pips}</span></button>`;
    })
    .join("");
}
