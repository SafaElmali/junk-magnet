import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { abilityImage } from "./ability-art";
import { t, upgradeName } from "./i18n";
export function evolutionGuideMarkup(): string {
  return `<p class="evolution-intro">${t("Reach both ranks in one run. Evolution activates automatically.")}</p><div class="evolution-recipes">${(
    Object.keys(EVOLUTIONS) as EvolutionId[]
  )
    .map((id) => {
      const r = EVOLUTIONS[id];
      return `<article class="evolution-recipe"><div class="evolution-pair">${abilityImage(r.weapon)}<span>+</span>${abilityImage(r.support)}</div><h4>${t(r.name)}</h4><p class="evolution-requirements">${upgradeName(r.weapon)} ${r.weaponRank}<br>${upgradeName(r.support)} ${r.supportRank}</p><p>${t(r.description)}</p></article>`;
    })
    .join("")}</div>`;
}
