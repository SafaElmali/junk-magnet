import { ROBOTS, canAffordWorkshop, getProgress } from "./progression";
import { track } from "./analytics";
import {
  setupWorkshop,
  workshopIcon,
  robotPortrait,
  minutes,
} from "./workshop";
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
// Scrap orbits the wordmark like the in-run magnet orbit. Each piece's static
// position doubles as the reduced-motion layout; CSS animates it otherwise.
const scrapPieces = [
  '<path d="M12 3.5 19.4 7.8v8.4L12 20.5 4.6 16.2V7.8Z" fill="#cdd6cf" stroke="#657f7c" stroke-width="1.6"/><circle cx="12" cy="12" r="3.3" fill="#173342"/>',
  '<path d="M9.5 10h5v10.5h-5Z" fill="#b9c5bf" stroke="#657f7c" stroke-width="1.4"/><path d="M6 4.5h12l1.5 5.5h-15Z" fill="#efbd56" stroke="#a16734" stroke-width="1.4"/>',
  '<path d="m12 2 2 3.2 3.6-1 .3 3.7 3.5 1.2-1.9 3.2 1.9 3.2-3.5 1.2-.3 3.7-3.6-1L12 22l-2-3.2-3.6 1-.3-3.7-3.5-1.2 1.9-3.2-1.9-3.2 3.5-1.2.3-3.7 3.6 1Z" fill="#cdd6cf" stroke="#657f7c" stroke-width="1.2"/><circle cx="12" cy="12" r="3.6" fill="#3c9298" stroke="#173342" stroke-width="1.2"/>',
  '<path d="M4 7.5 17.5 4l2.5 11.5L6.5 20Z" fill="#3c9298" stroke="#173342" stroke-width="1.4"/><circle cx="8" cy="9" r="1.3" fill="#e3ecdf"/><circle cx="16" cy="15" r="1.3" fill="#e3ecdf"/>',
  '<path d="M12 3.5 19.4 7.8v8.4L12 20.5 4.6 16.2V7.8Z" fill="#efbd56" stroke="#a16734" stroke-width="1.6"/><circle cx="12" cy="12" r="3.3" fill="#173342"/>',
];
const logoOrbit = `<span class="logo-orbit" aria-hidden="true"><i class="logo-ring is-back"></i><i class="logo-ring is-front"></i>${scrapPieces
  .map((piece, i) => {
    const angle = (i / scrapPieces.length) * Math.PI * 2;
    return `<i class="orbit-piece" style="--i:${i};--x:${Math.cos(angle).toFixed(3)};--y:${Math.sin(angle).toFixed(3)};--z:${Math.sin(angle) > 0 ? 1 : -2}"><i><svg viewBox="0 0 24 24" focusable="false">${piece}</svg></i></i>`;
  })
  .join("")}</span>`;
const partsIcon = icon(
  '<path d="M12 3.5 19.4 7.8v8.4L12 20.5 4.6 16.2V7.8Z"/><circle cx="12" cy="12" r="3"/>',
);
const swapIcon = icon('<path d="M4 8h13l-3-3M20 16H7l3 3"/>');
const previousIcon = icon('<path d="m14 6-6 6 6 6"/>');
const nextIcon = icon('<path d="m10 6 6 6-6 6"/>');

const audioControls = (channel: "sound" | "music", label: string) =>
  `<div class="audio-settings-controls"><button id="menu-${channel}-down" class="audio-volume-step" aria-label="${label}: Volume down">${icon('<path d="M6 12h12"/>')}</button><button id="menu-${channel}" class="menu-button audio-toggle" aria-labelledby="${channel}-label menu-${channel}-state" aria-pressed="true"><span id="menu-${channel}-state"></span><small id="menu-${channel}-value" aria-hidden="true"></small></button><button id="menu-${channel}-up" class="audio-volume-step" aria-label="${label}: Volume up">${icon('<path d="M6 12h12M12 6v12"/>')}</button></div>`;

export const menuMarkup = `
<div class="menu-shell">
  <div class="menu-brand"><span class="menu-eyebrow">SURVIVE. SALVAGE. REPEAT.</span><h2>JUNK<span class="logo-line">MAGNET</span>${logoOrbit}</h2><p>THE SWARM IS YOUR AMMO.</p></div>
  <div class="menu-home" id="menu-home">
    <nav class="menu-actions" aria-label="Main menu">
      <button id="start" class="menu-button menu-play"><span id="start-label">PLAY</span>${playIcon}</button>
      <button id="new-run" class="menu-button hidden">${menuIcons.restart}<span>NEW RUN</span></button>
      <button id="menu-workshop" class="menu-button">${workshopIcon}<span>WORKSHOP</span><b id="menu-parts" class="menu-parts hidden" aria-hidden="true"></b></button>
      <button id="menu-abilities" class="menu-button">${menuIcons.abilities}<span>ABILITIES</span></button>
      <button id="menu-settings" class="menu-button">${menuIcons.settings}<span>SETTINGS</span></button>
      <button id="menu-help" class="menu-button">${menuIcons.help}<span>HOW TO PLAY</span></button>
    </nav>
    <aside class="pilot-card" aria-label="Your character">
      <span class="pilot-tag">YOUR SURVIVOR</span>
      <div class="pilot-art" aria-hidden="true"></div>
      <h3 id="menu-pilot-name">SCRAP-01</h3><p id="menu-pilot-copy">Tiny robot. Endless potential.</p>
      <div class="pilot-weapon"><span>STARTING WEAPON</span><strong id="menu-weapon"></strong></div>
      <button id="menu-robots" class="pilot-change">${swapIcon}<span>CHANGE ROBOT</span></button>
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
      <div class="audio-setting"><span id="sound-label">Sound</span>${audioControls("sound", "Sound")}<input id="menu-sound-volume" class="audio-volume-bar" type="range" min="0" max="100" step="1" aria-labelledby="sound-label" /></div>
      <div class="audio-setting"><span id="music-label">Music</span>${audioControls("music", "Music")}<input id="menu-music-volume" class="audio-volume-bar" type="range" min="0" max="100" step="1" aria-labelledby="music-label" /></div>
    </div>
    <div id="menu-language-picker" class="menu-picker hidden"></div>
    <div id="menu-quality-picker" class="menu-picker quality-picker hidden"></div>
  </section>
  <div class="menu-stage"><span class="stage-mark">${endlessIcon}</span><div><strong>THE SCRAPYARD</strong><span>Endless survival · Increasing difficulty</span></div><span class="stage-status" id="menu-best">READY</span></div>
  <span class="intro-note"><span>Move with WASD or arrows · Attacks are automatic</span>${
    // CrazyGames forbids links out of the game; its build also omits the guide page.
    import.meta.env.MODE === "crazygames"
      ? ""
      : ' · <a href="/guide/" target="_blank" rel="noopener" aria-label="Gameplay guide (opens in a new tab)">Gameplay guide</a>'
  }</span>
</div>`;

export function setupMenu(actions: {
  start: () => void;
  restart: () => void;
  help: () => void;
  language: (next: Language) => void;
  quality: (next: GraphicsQuality) => void;
  sound: () => void;
  soundEnabled: () => boolean;
  music: () => void;
  musicEnabled: () => boolean;
  volume: (channel: "sound" | "music") => number;
  changeVolume: (channel: "sound" | "music", amount: number) => void;
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
  // Returning from the workshop restores focus to whichever control opened it.
  let workshopOpener = "menu-workshop";
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
    const progress = getProgress();
    const robot = ROBOTS.find((robot) => robot.id === progress.selectedRobot)!;
    const affordable = canAffordWorkshop(progress);
    el("menu-parts").innerHTML = `${partsIcon}<span>${progress.parts}</span>`;
    el("menu-parts").classList.toggle("hidden", progress.parts === 0);
    el("menu-parts").classList.toggle("is-ready", affordable);
    if (progress.parts)
      el("menu-workshop").setAttribute(
        "aria-label",
        `${t("WORKSHOP")} · ${progress.parts} ${t("Parts")}${affordable ? ` · ${t("Upgrade available")}` : ""}`,
      );
    else el("menu-workshop").removeAttribute("aria-label");
    el("menu-best").classList.toggle("is-record", progress.bestTime > 0);
    el("menu-best").textContent = progress.bestTime
      ? t("BEST {time}", { time: minutes(progress.bestTime) })
      : t("READY");
    el("menu-weapon").textContent = upgradeName(robot.startingWeapon);
    el("menu-pilot-name").textContent = robot.name;
    el("menu-pilot-copy").textContent = t(robot.description);
    document.querySelector(".pilot-art")!.innerHTML = robotPortrait(robot.id);
    el("menu-workshop").querySelector("span")!.textContent = t("WORKSHOP");
    el("menu-robots").querySelector("span")!.textContent = t("CHANGE ROBOT");
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
    for (const [id, label, enabled] of [
      ["menu-sound", "Sound", actions.soundEnabled()],
      ["menu-music", "Music", actions.musicEnabled()],
    ] as const) {
      el(id).setAttribute("aria-pressed", String(enabled));
      const channel = id === "menu-sound" ? "sound" : "music";
      const volume = actions.volume(channel);
      el(id).title = `${t(label)}: ${t(enabled ? "ON" : "OFF")} · ${volume}%`;
      el(`${id}-state`).textContent = t(enabled ? "ON" : "OFF");
      el(`${id}-value`).textContent = `${volume}%`;
      const slider = el(`${id}-volume`) as HTMLInputElement;
      slider.value = String(volume);
      slider.setAttribute("aria-valuetext", `${volume}%`);
      slider.style.setProperty("--volume", `${volume}%`);
      for (const direction of ["down", "up"] as const) {
        const button = el(`${id}-${direction}`) as HTMLButtonElement;
        button.setAttribute(
          "aria-label",
          `${t(label)}: ${t(direction === "down" ? "Volume down" : "Volume up")}`,
        );
        button.title = `${button.getAttribute("aria-label")} · ${volume}%`;
        button.disabled = direction === "down" ? volume === 0 : volume === 100;
      }
    }
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
            ? workshopOpener
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
  el("menu-workshop").addEventListener("click", () => {
    workshopOpener = "menu-workshop";
    show("workshop");
  });
  el("menu-robots").addEventListener("click", () => {
    workshopOpener = "menu-robots";
    workshop.showRobots();
    show("workshop");
  });
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
  el("menu-music").addEventListener("click", actions.music);
  for (const channel of ["sound", "music"] as const) {
    el(`menu-${channel}-volume`).addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      actions.changeVolume(channel, value - actions.volume(channel));
    });
    for (const [direction, amount] of [
      ["down", -10],
      ["up", 10],
    ] as const) {
      el(`menu-${channel}-${direction}`).addEventListener("click", () =>
        actions.changeVolume(channel, amount),
      );
    }
  }
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
