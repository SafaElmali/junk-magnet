import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { abilityImage } from "./ability-art";
import { t, upgradeName } from "./i18n";

const arrow = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
/** Recipes per page: all six on wide screens; compact screens page like the ability grid. */
export function evolutionPageSize(width = innerWidth, height = innerHeight): number {
  if (width > 700 && height > 550) return 6;
  // Short landscape shows one row: three columns, or two wider ones on small phones.
  if (height <= 420) return width > 700 ? 3 : 2;
  return height <= 700 ? 2 : 3;
}
export function evolutionGuideMarkup(sheet = 0, size = 6): string {
  const ids = Object.keys(EVOLUTIONS) as EvolutionId[];
  const pages = Math.ceil(ids.length / size);
  sheet = Math.max(0, Math.min(sheet, pages - 1));
  const nav =
    pages > 1
      ? `<nav class="ability-pagination evolution-pagination" aria-label="${t("Ability pages")}"><button data-evolution-page="previous" aria-label="${t("Previous page")}" ${sheet === 0 ? "disabled" : ""}>${arrow("m14 6-6 6 6 6")}</button><span aria-live="polite">${sheet + 1} / ${pages}</span><button data-evolution-page="next" aria-label="${t("Next page")}" ${sheet === pages - 1 ? "disabled" : ""}>${arrow("m10 6 6 6-6 6")}</button></nav>`
      : "";
  return `<p class="evolution-intro">${t("Reach both ranks in one run. Evolution activates automatically.")}</p><div class="evolution-recipes">${ids
    .slice(sheet * size, (sheet + 1) * size)
    .map((id) => {
      const r = EVOLUTIONS[id];
      return `<article class="evolution-recipe"><div class="evolution-pair">${abilityImage(r.weapon)}<span>+</span>${abilityImage(r.support)}</div><h4>${t(r.name)}</h4><p class="evolution-requirements">${upgradeName(r.weapon)} ${r.weaponRank}<br>${upgradeName(r.support)} ${r.supportRank}</p><p>${t(r.description)}</p></article>`;
    })
    .join("")}</div>${nav}`;
}
/** Owns the recipe page and its pagination so the menu only asks it to render. */
export function setupEvolutionGuide(container: HTMLElement) {
  let sheet = 0,
    size = evolutionPageSize();
  const render = () => {
    size = evolutionPageSize();
    container.innerHTML = evolutionGuideMarkup(sheet, size);
  };
  container.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-evolution-page]");
    if (!button) return;
    const direction = button.dataset.evolutionPage;
    sheet += direction === "next" ? 1 : -1;
    render();
    // Keep focus on the pressed control until it disables at the last page.
    (
      container.querySelector<HTMLButtonElement>(`[data-evolution-page="${direction}"]:not(:disabled)`) ??
      container.querySelector<HTMLButtonElement>("[data-evolution-page]:not(:disabled)")
    )?.focus({ preventScroll: true });
  });
  window.addEventListener("resize", () => {
    if (container.classList.contains("hidden") || evolutionPageSize() === size) return;
    sheet = 0;
    render();
  });
  return {
    render,
    reset() {
      sheet = 0;
    },
  };
}
