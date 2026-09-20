import {
  getLanguage,
  t,
  upgradeName,
  localizedUpgradeDescription,
} from "./i18n";
import { createState, UPGRADES, type UpgradeId } from "./simulation";

export const menuMarkup = `
<div class="menu-shell">
  <div class="menu-brand"><span class="menu-eyebrow">SURVIVE. SALVAGE. REPEAT.</span><h2>JUNK<span>MAGNET</span></h2><p>THE SWARM IS YOUR AMMO.</p></div>
  <div class="menu-home" id="menu-home">
    <nav class="menu-actions" aria-label="Main menu">
      <button id="start" class="menu-button menu-play"><span id="start-label">PLAY</span><span aria-hidden="true">▶</span></button>
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
  <div class="menu-stage"><span class="stage-mark" aria-hidden="true">∞</span><div><strong>THE SCRAPYARD</strong><span>Endless survival · Increasing difficulty</span></div><span class="stage-status">READY</span></div>
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
    if (page === "abilities") {
      const base = createState();
      base.upgrades.saw = 0;
      el("menu-library").innerHTML = (Object.keys(UPGRADES) as UpgradeId[])
        .map(
          (id, index) =>
            `<article><span>${String(index + 1).padStart(2, "0")}</span><div><h4>${upgradeName(id)}</h4><p>${localizedUpgradeDescription(base, id)}</p></div></article>`,
        )
        .join("");
    }
  }
  function show(next: typeof page, focus = true) {
    const previous = page;
    page = next;
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
  el("start").addEventListener("click", actions.start);
  el("new-run").addEventListener("click", actions.restart);
  el("menu-help").addEventListener("click", actions.help);
  el("menu-abilities").addEventListener("click", () => show("abilities"));
  el("menu-settings").addEventListener("click", () => show("settings"));
  el("menu-back").addEventListener("click", () => show("home"));
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
      show("home");
      return true;
    },
    isHome: () => page === "home",
  };
}
