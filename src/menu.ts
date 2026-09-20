import { getLanguage, t, upgradeName } from "./i18n";
import { UPGRADES, type UpgradeId } from "./simulation";
import {
  abilityGuide,
  abilityImage,
  type AbilityCategory,
} from "./ability-art";

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const playIcon = icon(
  '<path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none"/>',
);
const endlessIcon = icon(
  '<path d="M12 12c-3-5-9-5-9 0s6 5 9 0 9-5 9 0-6 5-9 0Z"/>',
);
const previousIcon = icon('<path d="m14 6-6 6 6 6"/>');
const nextIcon = icon('<path d="m10 6 6 6-6 6"/>');

export const menuMarkup = `
<div class="menu-shell">
  <div class="menu-brand"><span class="menu-eyebrow">SURVIVE. SALVAGE. REPEAT.</span><h2>JUNK<span>MAGNET</span></h2><p>THE SWARM IS YOUR AMMO.</p></div>
  <div class="menu-home" id="menu-home">
    <nav class="menu-actions" aria-label="Main menu">
      <button id="start" class="menu-button menu-play"><span id="start-label">PLAY</span>${playIcon}</button>
      <button id="new-run" class="menu-button hidden">NEW RUN</button>
      <button id="menu-abilities" class="menu-button">ABILITIES</button>
      <button id="menu-settings" class="menu-button">SETTINGS</button>
      <button id="menu-help" class="menu-button">HOW TO PLAY</button>
    </nav>
    <aside class="pilot-card" aria-label="Your character">
      <span class="pilot-tag">YOUR SURVIVOR</span>
      <svg class="pilot-art" viewBox="0 0 260 220" aria-hidden="true"><ellipse cx="130" cy="195" rx="81" ry="12" fill="#0b2029"/><g transform="rotate(-7 130 120)"><path d="M95 68V28h20v35c0 17 30 17 30 0V28h20v40c0 43-70 43-70 0" fill="#cd4e39" stroke="#142f3b" stroke-width="5"/><path d="M95 28h20v17H95zm50 0h20v17h-20z" fill="#fff6e3"/><rect x="61" y="132" width="33" height="63" rx="12" fill="#263c41" stroke="#071e29" stroke-width="5"/><rect x="166" y="132" width="33" height="63" rx="12" fill="#263c41" stroke="#071e29" stroke-width="5"/><path d="M67 146h20m-20 14h20m-20 14h20m86-28h20m-20 14h20m-20 14h20" stroke="#67736a" stroke-width="5"/><rect x="82" y="91" width="96" height="91" rx="25" fill="#edba4b" stroke="#132f3b" stroke-width="5"/><path d="M97 102h65" stroke="#ffe8a0" stroke-width="6" stroke-linecap="round"/><rect x="96" y="117" width="68" height="39" rx="18" fill="#173342"/><ellipse cx="115" cy="133" rx="6" ry="9" fill="#a2eced"/><ellipse cx="145" cy="133" rx="6" ry="9" fill="#a2eced"/><path d="M117 169h26" stroke="#b17832" stroke-width="5" stroke-linecap="round"/></g><path d="m38 87 8 8-8 8-8-8zm177 46 7 7-7 7-7-7z" fill="#74b6b6"/><circle cx="212" cy="68" r="10" fill="none" stroke="#bcbaa0" stroke-width="5"/></svg>
      <h3>SCRAP-01</h3><p>Tiny robot. Endless potential.</p>
      <div class="pilot-weapon"><span>STARTING WEAPON</span><strong id="menu-weapon"></strong></div>
    </aside>
  </div>
  <section id="menu-panel" class="menu-panel hidden" aria-labelledby="menu-panel-title">
    <header><h3 id="menu-panel-title"></h3><button id="menu-back" class="menu-back">BACK</button></header>
    <div id="menu-library" class="menu-library hidden"></div>
    <div id="menu-options" class="menu-options hidden">
      <div><span>Language</span><button id="menu-language" class="menu-button"></button></div>
      <div><span>Sound</span><button id="menu-sound" class="menu-button" aria-pressed="false"></button></div>
      <p>Move. Collect. Choose your upgrades. Attacks are automatic.</p>
    </div>
  </section>
  <div class="menu-stage"><span class="stage-mark">${endlessIcon}</span><div><strong>THE SCRAPYARD</strong><span>Endless survival · Increasing difficulty</span></div><span class="stage-status">READY</span></div>
  <span class="intro-note">Move with WASD or arrows · Attacks are automatic</span>
</div>`;

export function setupMenu(actions: {
  start: () => void;
  restart: () => void;
  help: () => void;
  language: () => void;
  sound: () => void;
  soundEnabled: () => boolean;
}) {
  const el = (id: string) => document.getElementById(id)!;
  let page: "home" | "abilities" | "settings" = "home";
  let resumable = false;
  let category: AbilityCategory | "All" = "All";
  let selected: UpgradeId = "saw";
  let sheet = 0;
  let detailOpen = false;
  const compact = () =>
    matchMedia("(max-width: 700px), (max-height: 550px)").matches;
  const pageSize = () =>
    !compact()
      ? 10
      : innerHeight <= 420
        ? innerWidth < 640
          ? 3
          : 4
        : innerWidth <= 360
          ? 4
          : 6;
  function closeDetail() {
    detailOpen = false;
    renderLibrary();
    el("menu-library")
      .querySelector<HTMLElement>(`[data-ability="${selected}"]`)
      ?.focus({ preventScroll: true });
  }
  function renderLibrary() {
    const ids = (Object.keys(UPGRADES) as UpgradeId[]).filter(
      (id) => category === "All" || abilityGuide[id].category === category,
    );
    if (!ids.includes(selected)) selected = ids[0];
    const maxRank = UPGRADES[selected].maxRank;
    const size = pageSize();
    const pages = Math.ceil(ids.length / size);
    sheet = Math.min(sheet, pages - 1);
    const visible = ids.slice(sheet * size, (sheet + 1) * size);
    const single = compact() && detailOpen;
    el("menu-back").textContent = t(single ? "ALL ABILITIES" : "BACK");
    el("menu-library").dataset.view = single ? "detail" : "gallery";
    el("menu-library").style.setProperty(
      "--ability-columns",
      String(!compact() ? 5 : innerHeight <= 420 ? size : size === 4 ? 2 : 3),
    );
    el("menu-library").innerHTML = `
      <div class="ability-filters ${single ? "hidden" : ""}" role="group" aria-label="${t("Filter abilities")}">${(["All", "Weapons", "Support", "Supplies"] as const).map((filter) => `<button data-filter="${filter}" aria-pressed="${category === filter}">${t(filter)}</button>`).join("")}</div>
      <div class="ability-browser ${single ? "detail-only" : ""}"><div class="ability-grid ${single ? "hidden" : ""}">${visible.map((id) => `<button class="ability-tile" data-ability="${id}" aria-pressed="${selected === id}" aria-controls="ability-detail">${abilityImage(id)}<strong>${upgradeName(id)}</strong></button>`).join("")}</div>
      <section class="ability-detail ${compact() && !single ? "hidden" : ""}" id="ability-detail" tabindex="-1" aria-live="polite" aria-labelledby="ability-detail-name">
        <div class="detail-art">${abilityImage(selected)}</div>
        <div class="detail-copy"><span class="detail-category">${t(abilityGuide[selected].category)}</span>
        <h4 id="ability-detail-name">${upgradeName(selected)}</h4>
        <p>${t(abilityGuide[selected].description)}</p>
        <div class="detail-meta"><span>${t(Number.isFinite(maxRank) ? "MAX RANK" : "REPEATABLE")}</span><strong>${Number.isFinite(maxRank) ? maxRank : endlessIcon}</strong></div>
        <span class="detail-acquisition">${t(selected === "saw" ? "Your starting weapon" : "Available through level-up choices")}</span></div>
      </section></div>
      <nav class="ability-pagination ${single ? "hidden" : ""}" aria-label="${t("Ability pages")}"><button data-page="previous" aria-label="${t("Previous page")}" ${sheet === 0 ? "disabled" : ""}>${previousIcon}</button><span aria-live="polite">${sheet + 1} / ${pages}</span><button data-page="next" aria-label="${t("Next page")}" ${sheet === pages - 1 ? "disabled" : ""}>${nextIcon}</button></nav>`;
  }

  function refresh() {
    el("start-label").textContent = t(resumable ? "CONTINUE" : "PLAY");
    el("new-run").classList.toggle("hidden", !resumable);
    el("menu-weapon").textContent = upgradeName("saw");
    el("menu-language").textContent =
      getLanguage() === "tr" ? "Türkçe" : "English";
    el("menu-sound").textContent = t(actions.soundEnabled() ? "ON" : "OFF");
    el("menu-sound").setAttribute(
      "aria-pressed",
      String(actions.soundEnabled()),
    );
    el("menu-panel-title").textContent = t(
      page === "abilities" ? "ABILITIES" : "SETTINGS",
    );
    if (page === "abilities") renderLibrary();
  }

  function show(next: typeof page, focus = true) {
    const previous = page;
    page = next;
    detailOpen = false;
    document
      .querySelector(".menu-shell")!
      .classList.toggle("is-submenu", page !== "home");
    document
      .querySelector(".menu-shell")!
      .classList.toggle("is-library", page === "abilities");
    el("menu-home").classList.toggle("hidden", page !== "home");
    el("menu-panel").classList.toggle("hidden", page === "home");
    el("menu-library").classList.toggle("hidden", page !== "abilities");
    el("menu-options").classList.toggle("hidden", page !== "settings");
    refresh();
    if (focus)
      el(
        page === "home"
          ? previous === "abilities"
            ? "menu-abilities"
            : "menu-settings"
          : "menu-back",
      ).focus();
  }
  el("menu-library").addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    if (button.dataset.filter) {
      category = button.dataset.filter as typeof category;
      sheet = 0;
      detailOpen = false;
    }
    if (button.dataset.page) sheet += button.dataset.page === "next" ? 1 : -1;
    if (button.dataset.ability) {
      selected = button.dataset.ability as UpgradeId;
      detailOpen = true;
    }
    renderLibrary();
    if (button.dataset.ability && compact()) {
      el("ability-detail").focus({ preventScroll: true });
      return;
    }
    const focusSelector = button.dataset.filter
      ? `[data-filter="${category}"]`
      : button.dataset.page
        ? `.ability-pagination button:not(:disabled)`
        : `[data-ability="${selected}"]`;
    el("menu-library")
      .querySelector<HTMLElement>(focusSelector)
      ?.focus({ preventScroll: true });
  });
  let layoutKey = `${compact()}:${pageSize()}`;
  window.addEventListener("resize", () => {
    const next = `${compact()}:${pageSize()}`;
    if (next === layoutKey) return;
    layoutKey = next;
    sheet = 0;
    detailOpen = false;
    if (page === "abilities") {
      renderLibrary();
      el("menu-back").focus({ preventScroll: true });
    }
  });
  el("start").addEventListener("click", actions.start);
  el("new-run").addEventListener("click", actions.restart);
  el("menu-help").addEventListener("click", actions.help);
  el("menu-abilities").addEventListener("click", () => show("abilities"));
  el("menu-settings").addEventListener("click", () => show("settings"));
  el("menu-back").addEventListener("click", () =>
    detailOpen && compact() ? closeDetail() : show("home"),
  );
  el("menu-language").addEventListener("click", actions.language);
  el("menu-sound").addEventListener("click", actions.sound);
  return {
    refresh,
    enter(canResume: boolean) {
      resumable = canResume;
      show("home", false);
      el("start").focus();
    },
    back() {
      if (page === "home") return false;
      if (detailOpen && compact()) {
        closeDetail();
        return true;
      }
      show("home");
      return true;
    },
    isHome: () => page === "home",
  };
}
