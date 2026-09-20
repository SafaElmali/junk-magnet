import { abilityImage } from "./ability-art";
import { t, upgradeName } from "./i18n";
import { UPGRADES, type State, type UpgradeId } from "./simulation";

export function resultBuildMarkup(state: State): string {
  return (Object.keys(state.upgrades) as UpgradeId[])
    .filter(
      (id) => Number.isFinite(UPGRADES[id].maxRank) && state.upgrades[id] > 0,
    )
    .map(
      (id) =>
        `<li class="result-module" aria-label="${t("{name}, rank {rank}", { name: upgradeName(id), rank: state.upgrades[id] })}"><div class="result-module-art">${abilityImage(id)}<b aria-hidden="true">${state.upgrades[id]}</b></div><span aria-hidden="true">${upgradeName(id)}</span></li>`,
    )
    .join("");
}
