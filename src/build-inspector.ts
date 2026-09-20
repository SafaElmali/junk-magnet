import { abilityGuide, abilityImage } from "./ability-art";
import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { t, upgradeName } from "./i18n";
import { UPGRADES, type State, type UpgradeId } from "./simulation";
import "./build-inspector.css";

export function setupBuildInspector(actions: {
  state: () => State;
  open: () => void;
  close: () => void;
  notice?: () => string;
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "build-inspector";
  dialog.setAttribute("aria-labelledby", "build-inspector-title");
  document.getElementById("app")!.append(dialog);
  let selected: UpgradeId = "saw";
  let trigger: HTMLElement | null = null;
  const owned = () => (Object.keys(actions.state().upgrades) as UpgradeId[])
    .filter(id => Number.isFinite(UPGRADES[id].maxRank) && actions.state().upgrades[id] > 0);
  const evolutionFor = (id: UpgradeId) => (Object.keys(EVOLUTIONS) as EvolutionId[])
    .find(key => actions.state().evolutions[key] && EVOLUTIONS[key].weapon === id);
  const nameFor = (id: UpgradeId) => {
    const evolution = evolutionFor(id);
    return evolution ? t(EVOLUTIONS[evolution].name) : upgradeName(id);
  };
  function render() {
    const state = actions.state();
    const evolution = evolutionFor(selected);
    const rank = state.upgrades[selected];
    const max = UPGRADES[selected].maxRank;
    dialog.innerHTML = `<header class="build-inspector-heading"><h2 id="build-inspector-title">${t("YOUR BUILD")}</h2><button type="button" class="build-inspector-close" data-close aria-label="${t("BACK TO THE YARD")}">×</button></header>
      <div class="build-inspector-body"><nav class="build-inspector-list" aria-label="${t("Current abilities")}">${owned().map(id => `<button type="button" data-inspect="${id}" aria-pressed="${id === selected}" aria-controls="build-inspector-detail">${abilityImage(id)}<span><strong>${nameFor(id)}</strong><small>${actions.state().upgrades[id]} / ${UPGRADES[id].maxRank}</small></span></button>`).join("")}</nav>
      <section id="build-inspector-detail" class="${evolution ? "is-evolved" : ""}" aria-live="polite" aria-atomic="true"><div class="build-inspector-art">${abilityImage(selected)}${evolution ? '<span aria-hidden="true">✦</span>' : ""}</div><span class="build-inspector-category">${t(abilityGuide[selected].category)}</span><h3>${nameFor(selected)}</h3><div class="build-inspector-rank" aria-label="${t("{name}, rank {rank}", { name: nameFor(selected), rank })}"><span aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < rank ? "is-filled" : ""}"></i>`).join("")}</span><b aria-hidden="true">${rank} / ${max}</b></div><p>${t(evolution ? EVOLUTIONS[evolution].description : abilityGuide[selected].description)}</p></section></div>
      <footer>${actions.notice?.() ? `<p class="build-inspector-notice">${actions.notice()}</p>` : ""}<button type="button" class="primary-btn" data-close>${t("BACK TO THE YARD")} <span aria-hidden="true">→</span></button></footer>`;
  }
  dialog.addEventListener("click", event => {
    const target = event.target as Element;
    if (target.closest("[data-close]") || target === dialog) dialog.close();
    const id = target.closest<HTMLElement>("[data-inspect]")?.dataset.inspect as UpgradeId | undefined;
    if (id && owned().includes(id)) {
      selected = id;
      render();
      dialog.querySelector<HTMLButtonElement>(`[data-inspect="${id}"]`)?.focus({ preventScroll: true });
    }
  });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button")];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener("close", () => {
    actions.close();
    // The HUD is visible again before restoring focus to its tile.
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  return {
    get isOpen() { return dialog.open; },
    open(id: UpgradeId, source: HTMLElement) {
      if (dialog.open || !owned().includes(id) || actions.state().phase !== "playing") return;
      selected = id;
      trigger = source;
      actions.open();
      render();
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>(`[data-inspect="${id}"]`)?.focus();
    },
    close() { if (dialog.open) dialog.close(); },
  };
}
