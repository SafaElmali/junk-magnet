import { ROBOTS, getProgress } from "./progression";
import { track } from "./analytics";
import { setupWorkshop, workshopIcon, robotPortrait } from "./workshop";
import { evolutionGuideMarkup } from "./evolutions";
import {
  getLanguage,
  t,
  upgradeName,
  LANGUAGES,
  languageFlag,
  type Language,
} from "./i18n";
import {
  GRAPHICS_QUALITIES,
  getGraphicsQuality,
  type GraphicsQuality,
} from "./graphics";
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
const menuIcons = {
  restart: icon('<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>'),
  abilities: icon('<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>'),
  settings: icon(
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#2c484e"/><circle cx="16" cy="17" r="3" fill="#2c484e"/>',
  ),
  help: icon(
    '<path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4ZM12 6v15M7 8h2M7 12h2m6-4h2m-2 4h2"/>',
  ),
  All: icon(
    '<rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" fill-opacity=".2"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" fill-opacity=".2"/>',
  ),
  Weapons: icon(
    '<path d="m12 2 2.4 3.7 4.4-.8-.8 4.4 3.7 2.7-3.7 2.4.8 4.4-4.4-.8L12 22l-2.4-4-4.4.8.8-4.4L2 12l4-2.7-.8-4.4 4.4.8Z" fill="currentColor" fill-opacity=".18"/><circle cx="12" cy="12" r="3"/>',
  ),
  Support: icon(
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" fill="currentColor" fill-opacity=".18"/><path d="M12 8v8m-4-4h8"/>',
  ),
  Supplies: icon(
    '<path d="M3 8h18v13H3Z" fill="currentColor" fill-opacity=".18"/><path d="m3 8 4-5h10l4 5M9 8v5l3-2 3 2V8M7 17h3"/>',
  ),
  quality: icon(
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M6 13l4-4 3 3 2-2 3 3"/>',
  ),
};
const qualityLabels: Record<GraphicsQuality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  high: "High",
  ultra: "Ultra",
};
const qualityDescriptions: Record<GraphicsQuality, string> = {
  performance: "Lower resolution, lighter effects",
  balanced: "Balanced resolution and effects",
  high: "Sharp resolution, richer shadows",
  ultra: "Maximum resolution and effects",
};
const previousIcon = icon('<path d="m14 6-6 6 6 6"/>');
const nextIcon = icon('<path d="m10 6 6 6-6 6"/>');

export const menuMarkup = `
<div class="menu-shell">
  <div class="menu-brand"><span class="menu-eyebrow">SURVIVE. SALVAGE. REPEAT.</span><h2>JUNK<span>MAGNET</span></h2><p>THE SWARM IS YOUR AMMO.</p></div>
  <div class="menu-home" id="menu-home">
    <nav class="menu-actions" aria-label="Main menu">
      <button id="start" class="menu-button menu-play"><span id="start-label">PLAY</span>${playIcon}</button>
      <button id="new-run" class="menu-button hidden">${menuIcons.restart}<span>NEW RUN</span></button>
      <button id="menu-workshop" class="menu-button">${workshopIcon}<span>WORKSHOP</span></button>
      <button id="menu-abilities" class="menu-button">${menuIcons.abilities}<span>ABILITIES</span></button>
      <button id="menu-settings" class="menu-button">${menuIcons.settings}<span>SETTINGS</span></button>
      <button id="menu-help" class="menu-button">${menuIcons.help}<span>HOW TO PLAY</span></button>
    </nav>
    <aside class="pilot-card" aria-label="Your character">
      <span class="pilot-tag">YOUR SURVIVOR</span>
      <div class="pilot-art" aria-hidden="true"></div>
      <h3 id="menu-pilot-name">SCRAP-01</h3><p id="menu-pilot-copy">Tiny robot. Endless potential.</p>
      <div class="pilot-weapon"><span>STARTING WEAPON</span><strong id="menu-weapon"></strong></div>
    </aside>
  </div>
  <section id="menu-panel" class="menu-panel hidden" aria-labelledby="menu-panel-title">
    <header><h3 id="menu-panel-title"></h3><div class="menu-panel-tools"><button id="menu-evolutions-open" class="hidden" aria-label="EVOLUTIONS" title="EVOLUTIONS">${menuIcons.abilities}<span>Recipes</span></button><button id="menu-back" class="menu-back">BACK</button></div></header>
    <div id="menu-workshop-content" class="hidden"></div>
    <div id="menu-evolutions" class="hidden"></div>
    <div id="menu-library" class="menu-library hidden"></div>
    <div id="menu-options" class="menu-options hidden">
      <div><span>Language</span><button id="menu-language" class="menu-button"></button></div>
      <div><span>Graphics quality</span><button id="menu-quality" class="menu-button"></button></div>
      <div><span>Sound</span><button id="menu-sound" class="menu-button" aria-pressed="false"></button></div>
    </div>
    <div id="menu-language-picker" class="menu-picker hidden"></div>
    <div id="menu-quality-picker" class="menu-picker quality-picker hidden"></div>
  </section>
  <div class="menu-stage"><span class="stage-mark">${endlessIcon}</span><div><strong>THE SCRAPYARD</strong><span>Endless survival · Increasing difficulty</span></div><span class="stage-status">READY</span></div>
  <span class="intro-note">Move with WASD or arrows · Attacks are automatic</span>
</div>`;

export function setupMenu(actions: {
  start: () => void;
  restart: () => void;
  help: () => void;
  language: (next: Language) => void;
  quality: (next: GraphicsQuality) => void;
  sound: () => void;
  soundEnabled: () => boolean;
}) {
  const el = (id: string) => document.getElementById(id)!;
  let page:
    | "home"
    | "abilities"
    | "settings"
    | "language"
    | "quality"
    | "workshop"
    | "evolutions" = "home";
  let resumable = false;
  const workshop = setupWorkshop(el("menu-workshop-content"), refresh);
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
      <div class="ability-filters ${single ? "hidden" : ""}" role="group" aria-label="${t("Filter abilities")}">${(["All", "Weapons", "Support", "Supplies"] as const).map((filter) => `<button data-filter="${filter}" aria-pressed="${category === filter}"><span class="category-icon" aria-hidden="true">${menuIcons[filter]}</span><span>${t(filter)}</span></button>`).join("")}</div>
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
    const robot = ROBOTS.find(
      (robot) => robot.id === getProgress().selectedRobot,
    )!;
    el("menu-weapon").textContent = upgradeName(robot.startingWeapon);
    el("menu-pilot-name").textContent = robot.name;
    el("menu-pilot-copy").textContent = t(robot.description);
    document.querySelector(".pilot-art")!.innerHTML = robotPortrait(robot.id);
    el("menu-workshop").querySelector("span")!.textContent = t("WORKSHOP");
    el("menu-evolutions-open").setAttribute("aria-label", t("EVOLUTIONS"));
    el("menu-evolutions-open").setAttribute("title", t("EVOLUTIONS"));
    el("menu-evolutions-open").querySelector("span")!.textContent =
      t("Recipes");
    const currentLanguage = LANGUAGES.find(
      ({ code }) => code === getLanguage(),
    )!;
    el("menu-language").innerHTML =
      `${languageFlag(currentLanguage.code)}<span>${currentLanguage.name}</span>`;
    el("menu-quality").innerHTML =
      `${menuIcons.quality}<span>${t(qualityLabels[getGraphicsQuality()])}</span>`;
    el("menu-language-picker").innerHTML = LANGUAGES.map(
      ({ code, name }) =>
        `<button class="menu-choice" data-language="${code}" lang="${code}" aria-pressed="${code === getLanguage()}">${languageFlag(code)}<span>${name}</span></button>`,
    ).join("");
    el("menu-quality-picker").innerHTML =
      GRAPHICS_QUALITIES.map(
        (quality) =>
          `<button class="menu-choice" data-quality="${quality}" aria-pressed="${quality === getGraphicsQuality()}">${menuIcons.quality}<span><strong>${t(qualityLabels[quality])}</strong><small>${t(qualityDescriptions[quality])}</small></span></button>`,
      ).join("") + `<p>${t("Graphics apply immediately.")}</p>`;
    el("menu-back").textContent = t("BACK");
    el("menu-sound").textContent = t(actions.soundEnabled() ? "ON" : "OFF");
    el("menu-sound").setAttribute(
      "aria-pressed",
      String(actions.soundEnabled()),
    );
    el("menu-panel-title").textContent = t(
      page === "workshop"
        ? "WORKSHOP"
        : page === "evolutions"
          ? "EVOLUTIONS"
          : page === "abilities"
            ? "ABILITIES"
            : page === "language"
              ? "Language"
              : page === "quality"
                ? "Graphics quality"
                : "SETTINGS",
    );
    if (page === "abilities") renderLibrary();
    if (page === "workshop") workshop.refresh();
    if (page === "evolutions")
      el("menu-evolutions").innerHTML = evolutionGuideMarkup();
  }

  function show(next: typeof page, focus = true) {
    const previous = page;
    if (next !== previous) track("menu_opened", { menu: next });
    page = next;
    detailOpen = false;
    document
      .querySelector(".menu-shell")!
      .classList.toggle("is-submenu", page !== "home");
    document
      .querySelector(".menu-shell")!
      .classList.toggle("is-library", page === "abilities");
    document
      .querySelector(".menu-shell")!
      .classList.toggle("is-workshop", page === "workshop");
    document
      .querySelector(".menu-shell")!
      .classList.toggle("is-evolutions", page === "evolutions");
    el("menu-workshop-content").classList.toggle("hidden", page !== "workshop");
    el("menu-evolutions").classList.toggle("hidden", page !== "evolutions");
    el("menu-evolutions-open").classList.toggle("hidden", page !== "abilities");
    if (page === "workshop") workshop.enter(resumable);
    el("menu-home").classList.toggle("hidden", page !== "home");
    el("menu-panel").classList.toggle("hidden", page === "home");
    el("menu-library").classList.toggle("hidden", page !== "abilities");
    el("menu-options").classList.toggle("hidden", page !== "settings");
    el("menu-language-picker").classList.toggle("hidden", page !== "language");
    el("menu-quality-picker").classList.toggle("hidden", page !== "quality");
    refresh();
    if (focus)
      el(
        page === "home"
          ? previous === "workshop"
            ? "menu-workshop"
            : previous === "abilities"
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
  el("menu-workshop").addEventListener("click", () => show("workshop"));
  el("menu-evolutions-open").addEventListener("click", () =>
    show("evolutions"),
  );
  el("menu-abilities").addEventListener("click", () => show("abilities"));
  el("menu-settings").addEventListener("click", () => show("settings"));
  const goBack = () => {
    if (page === "evolutions") show("abilities");
    else if (detailOpen && compact()) closeDetail();
    else if (page === "language" || page === "quality") {
      const opener = page === "language" ? "menu-language" : "menu-quality";
      show("settings", false);
      el(opener).focus();
    } else show("home");
  };
  el("menu-back").addEventListener("click", goBack);
  el("menu-language").addEventListener("click", () => show("language"));
  el("menu-quality").addEventListener("click", () => show("quality"));
  el("menu-language-picker").addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-language]",
    );
    if (!button) return;
    actions.language(button.dataset.language as Language);
    refresh();
    el("menu-language-picker")
      .querySelector<HTMLButtonElement>(`[data-language="${getLanguage()}"]`)
      ?.focus({ preventScroll: true });
  });
  el("menu-quality-picker").addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-quality]",
    );
    if (!button) return;
    actions.quality(button.dataset.quality as GraphicsQuality);
    refresh();
    el("menu-quality-picker")
      .querySelector<HTMLButtonElement>(
        `[data-quality="${getGraphicsQuality()}"]`,
      )
      ?.focus({ preventScroll: true });
  });
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
      goBack();
      return true;
    },
    isHome: () => page === "home",
  };
}
