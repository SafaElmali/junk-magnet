import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { abilityImage } from "./ability-art";
import { t, upgradeName } from "./i18n";
import { UPGRADES, type State, type UpgradeId } from "./simulation";

export function resultBuildMarkup(state: State): string {
  return (Object.keys(state.upgrades) as UpgradeId[])
    .filter(
      (id) => Number.isFinite(UPGRADES[id].maxRank) && state.upgrades[id] > 0,
    )
    .map((id) => {
      const evolution = (Object.keys(EVOLUTIONS) as EvolutionId[]).find(
        (key) => state.evolutions[key] && EVOLUTIONS[key].weapon === id,
      );
      const name = evolution ? t(EVOLUTIONS[evolution].name) : upgradeName(id);
      return `<li class="result-module${evolution ? " is-evolved" : ""}" aria-label="${t("{name}, rank {rank}", { name, rank: state.upgrades[id] })}"><div class="result-module-art">${abilityImage(id)}<b aria-hidden="true">${state.upgrades[id]}</b></div><span aria-hidden="true">${name}</span></li>`;
    })
    .join("");
}
