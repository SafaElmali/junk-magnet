import { CoopClient } from "./coop-client";
import { ct } from "./coop-text";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/barlow-condensed/latin-ext-700.css";
import "@fontsource/barlow-condensed/latin-ext-800.css";
import "@fontsource/dm-sans/latin-ext-400.css";
import "@fontsource/dm-sans/latin-ext-500.css";
import "@fontsource/dm-sans/latin-ext-700.css";
import "./style.css";
import "./play-hud.css";
import "./menu.css";
import "./help-art.css";
import "./pause-menu.css";
import "./opening-guide.css";
import "./result-menu.css";
import "./loading-screen.css";
import "./expansion.css";
import "./level-up.css";
import { upgradeChoicesMarkup } from "./level-up";
import {
  getRunConfig,
  recordRun,
  ROBOTS,
  type RunReceipt,
} from "./progression";
import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { getDiscoveryHint } from "./discovery";
import {
  discoveryFeedback,
  discoveryProgress,
  discoveryNames,
} from "./discovery-feedback";
import "./discovery-feedback.css";
import { loadingMarkup } from "./loading-screen";
import { resultBuildMarkup } from "./result-summary";
import { helpIllustration } from "./help-art";
import { setGraphicsQuality, type GraphicsQuality } from "./graphics";
import { menuMarkup, setupMenu } from "./menu";
import {
  t,
  LANGUAGES,
  languageFlag,
  type Language,
  getLanguage,
  setLanguage,
  bindStaticTranslations,
  upgradeName,
} from "./i18n";
import { YardScene } from "./scene";
import {
  createState,
  update,
  UPGRADES,
  chooseUpgrade,
  type UpgradeId,
  type Vec,
} from "./simulation";
const icons = {
  magnet:
    '<path d="M5 3v8a7 7 0 0 0 14 0V3h-5v8a2 2 0 0 1-4 0V3Z"/><path d="M5 7h5m4 0h5"/>',
  sound:
    '<path d="m4 9 4 0 5-4v14l-5-4H4Z"/><path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m4 9 4 0 5-4v14l-5-4H4Z"/><path d="m17 9 5 6m0-6-5 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6Z"/>',
  nut: '<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><circle cx="12" cy="12" r="4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  turret: '<path d="M5 20h14M8 20v-5h8v5M6 15V8h11v7ZM17 10h5M9 8V4h5v4"/>',
  burst:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  boots: '<path d="M6 3h7v10l7 3v5H4v-8h2ZM6 8h7m-7 3h7"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>',
  repair: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
};
const svg = (name: keyof typeof icons) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="masthead">
 <div class="wordmark"><h1>JUNK MAGNET<span class="logo-bolt">${svg("bolt")}</span></h1><p>THE SWARM IS YOUR AMMO.</p></div>
 <div class="session-label"><span class="live-dot"></span> THE SCRAPYARD <span class="divider">/</span> ENDLESS SHIFT</div>
 <nav aria-label="Game controls"><button class="icon-btn language-btn" id="language" aria-label="Türkçeye geç" title="Türkçe">TR</button><button class="icon-btn" id="sound" aria-label="Enable sound" aria-pressed="false">${svg("mute")}</button><button class="icon-btn" id="help" aria-label="How to play">${svg("help")}</button><button class="icon-btn pause-button" id="pause" aria-label="Pause game" disabled>${svg("pause")}</button></nav>
</header>
<main id="yard" aria-label="Game arena" tabindex="-1">
 <div class="top-progress" role="progressbar" aria-label="Experience toward next level" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0"><i id="xp-progress"></i><span class="xp-meter-copy" aria-hidden="true"><strong id="xp-current-level"></strong><span id="xp-meter-count"></span><strong id="xp-next-level"></strong></span></div>
 <section class="hud" aria-label="Game status">
  <div class="health-panel"><div class="robot-badge">${svg("magnet")}</div><div class="health-copy"><div class="health-heading"><strong id="level">LV. 1</strong><span id="health-value">100 / 100</span></div></div></div>
  <div class="timer-panel"><strong id="timer">00:00</strong><span id="wave">PRESSURE 1</span></div>
  <div class="salvage-panel">${svg("nut")}<div><strong id="kills">0</strong><span class="hud-label">JUNK RECYCLED</span></div></div>
 </section>
 <div class="health-track" role="progressbar" aria-label="Robot health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="health-fill"></i></div>
 <div class="yard-caption"><span id="xp-label">0 / 5 XP</span><i></i><span>COLLECT BLUE ENERGY. BUILD SOMETHING BIGGER.</span></div>
 <aside id="opening-guide" class="opening-guide hidden" role="status" aria-live="polite" aria-atomic="true"><svg class="opening-art" viewBox="0 0 72 48" aria-hidden="true"><g class="opening-collect-art"><path d="m8 10 7 3-3 7-7-3Zm-2 23 7-3 3 7-7 3Z" fill="#d7e0d9" stroke="#789a9c"/><path d="M21 16h10m-4-4 4 4-4 4M21 33h10m-4-4 4 4-4 4" fill="none" stroke="#8abfc2" stroke-width="2"/><path d="M40 8v17a12 12 0 0 0 24 0V8h-8v17a4 4 0 0 1-8 0V8Z" fill="#cf5945" stroke="#f28a68" stroke-width="1.5"/><path d="M40 8h8v7h-8Zm16 0h8v7h-8Z" fill="#fff0c8"/></g><g class="opening-orbit-art"><ellipse cx="23" cy="24" rx="17" ry="16" fill="none" stroke="#7ba9a6" stroke-dasharray="3 3"/><rect x="16" y="17" width="14" height="14" rx="4" fill="#edba53"/><path d="M19 22h8" stroke="#173441" stroke-width="3"/><path d="m7 8 6 2-2 6-6-2ZM32 33l6 2-2 6-6-2Z" fill="#d7e0d9"/><path d="M43 24h13m-5-5 5 5-5 5" fill="none" stroke="#edba53" stroke-width="2"/><rect x="62" y="19" width="7" height="10" rx="2" fill="#cf5945"/></g></svg><p id="opening-copy"></p></aside>
 <div id="ability-loadout" class="ability-loadout" aria-label="Current abilities"></div>
 <div id="boss-hud" class="boss-hud hidden"><span id="boss-name"></span><div role="progressbar" id="boss-health" aria-valuemin="0"><i id="boss-fill"></i></div></div>
 <div id="world-hint" class="world-hint hidden" role="status"></div>
 <div class="load-state" id="loading" role="status" aria-live="polite">${loadingMarkup}</div>
 <div class="intro hidden" id="intro">${menuMarkup}</div>
 <div class="touch-stick hidden" id="touch-stick" aria-label="Movement joystick"><div></div></div>
 <div class="modal-backdrop hidden" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-card"><div class="pause-heading pause-only"><span class="pause-location">${svg("magnet")}<span>THE SCRAPYARD</span></span><span class="pause-badge">${svg("pause")}</span></div><h2 id="modal-title">Taking a breather.</h2><p id="modal-copy"></p><div class="pause-summary pause-only"><div><span>SHIFT TIME</span><strong id="pause-time">00:00</strong></div><div><span>LEVEL REACHED</span><strong id="pause-level">1</strong></div><div><span>JUNK RECYCLED</span><strong id="pause-kills">0</strong></div></div><div id="help-content" class="hidden"><dl><div><dt>Move</dt><dd>WASD / arrow keys, or drag anywhere in the yard.</dd></div><div><dt>Collect</dt><dd>Get near silver scrap. It joins your orbit and attacks automatically.</dd></div><div><dt>Attack</dt><dd>Scrap fires at the nearest enemy automatically. Collect wreckage to reload.</dd></div><div><dt>Upgrade</dt><dd>Collect blue energy. Each level pauses the yard: choose one of three abilities with a tap or keys 1–3.</dd></div><div><dt>Recover</dt><dd>Your automatic pulse keeps firing when the orbit is empty. Collect wreckage to rebuild.</dd></div></dl><nav class="help-pages" aria-label="Help pages"><button id="help-previous" class="menu-back" aria-label="Previous step">${svg("arrow")}</button><span id="help-page"></span><button id="help-next" class="menu-back" aria-label="Next step">${svg("arrow")}</button></nav></div><div class="pause-actions"><button class="primary-btn" id="resume"><span id="resume-label">CONTINUE</span><span id="resume-icon">${svg("play")}</span></button><button class="text-btn" id="restart">${svg("reset")}<span>NEW RUN</span></button><button id="pause-menu" class="text-btn">${svg("home")}<span>MAIN MENU</span></button></div></div></div>
 <div class="upgrade hidden" id="upgrade" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><div class="upgrade-sheet"><header class="upgrade-heading"><span class="upgrade-emblem" aria-hidden="true">${svg("bolt")}</span><div><h2 id="upgrade-title">Level up</h2><p id="upgrade-copy">Level 2 · Pick one upgrade. The yard is paused.</p></div></header><div id="upgrade-choices" class="upgrade-choices"></div><p class="upgrade-note">Choose with 1, 2, or 3 · Your other abilities keep their upgrades.</p></div></div>
 <div class="result hidden" id="result" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="modal-card">
 <header class="result-heading"><div class="result-stamp">${svg("magnet")}<span id="result-stamp">BACK TO THE WORKSHOP</span></div><span class="result-unit">SCRAP-01</span></header>
 <h2 id="result-title">SHIFT COMPLETE</h2><p id="result-copy"></p>
 <div class="result-stats"><div class="result-stat-time"><span>${svg("clock")}<span>SHIFT TIME</span></span><strong id="result-time"></strong></div><div><span>${svg("nut")}<span>RECYCLED ENEMIES</span></span><strong id="result-kills"></strong></div><div><span>${svg("bolt")}<span>LEVEL REACHED</span></span><strong id="result-level"></strong></div></div>
 <section class="result-loadout" aria-labelledby="result-build-label"><h3 id="result-build-label">YOUR BUILD</h3><ul class="result-build" id="result-build"></ul></section>
 <p id="result-reward" class="result-reward"></p><div class="result-actions"><button class="primary-btn" id="again"><span>ONE MORE SHIFT</span>${svg("reset")}</button><button id="result-menu" class="text-btn">${svg("home")}<span>MAIN MENU</span></button></div>
 </div></div>
</main>
<footer class="workbench"><div class="controls"><span><kbd>W</kbd><span class="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><strong>MOVE</strong><i></i><strong>AUTO ATTACK</strong></div><p><span class="footer-dot"></span> ONE ROBOT. ENDLESS POTENTIAL.</p><span class="prototype-label">ENDLESS SURVIVAL <b>v0.2</b></span></footer>`;
document.querySelectorAll("#help-content dl > div").forEach((step, index) => {
  step.insertAdjacentHTML("afterbegin", helpIllustration(index));
});
app.classList.add("in-menu");
const translateStatic = bindStaticTranslations(app);
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let s = createState(getRunConfig()),
  scene: YardScene,
  loaded = false,
  last = 0,
  sound = false,
  modalBefore: "ready" | "playing" = "playing",
  lastFocus: HTMLElement | null = null;
let runId = crypto.randomUUID();
let runReceipt: RunReceipt | null = null;
const keys = new Set<string>();
let stick: Vec = { x: 0, z: 0 },
  showedResult = false,
  audio: AudioContext | undefined;
let shownUpgrade = "",
  shownLoadout = "",
  upgradeReadyAt = 0;
const touch = window.matchMedia("(pointer: coarse)").matches;
function beep(
  freq: number,
  duration = 0.06,
  type: OscillatorType = "sine",
  gain = 0.03,
) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const osc = audio.createOscillator(),
      g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      freq * 0.6,
      audio.currentTime + duration,
    );
    g.gain.setValueAtTime(gain, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(g);
    g.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {
    sound = false;
  }
}
function start() {
  if (!loaded || !menu.isHome()) return;
  if (s.time === 0) {
    s = createState(getRunConfig());
    runId = crypto.randomUUID();
    runReceipt = null;
    scene.clear();
  }
  keys.clear();
  stopStick();
  s.phase = "playing";
  app.classList.remove("in-menu");
  app.classList.add("in-run");
  el("yard").classList.add("is-playing");
  showedResult = false;
  el("intro").classList.add("hidden");
  el("result").classList.add("hidden");
  el("upgrade").classList.add("hidden");
  shownUpgrade = "";
  el<HTMLButtonElement>("pause").disabled = false;
  if (touch) el("touch-stick").classList.remove("hidden");
  el("yard").focus({ preventScroll: true });
  beep(320, 0.12);
}
function returnToMenu() {
  el("pause").innerHTML = svg("pause");
  el("pause").setAttribute("aria-label", t("Pause game"));
  if (coop.active) {
    coop.leave();
    s = createState(getRunConfig());
    scene.clear();
    el<HTMLButtonElement>("again").disabled = false;
    el("again").querySelector("span")!.textContent = t("ONE MORE SHIFT");
  }
  const canResume = s.phase !== "lost" && s.time > 0;
  keys.clear();
  stopStick();
  if (canResume) s.phase = "paused";
  else {
    s = createState(getRunConfig());
    scene.clear();
  }
  app.classList.remove("in-run");
  app.classList.add("in-menu");
  el("yard").classList.remove("is-playing");
  for (const id of ["modal", "result", "upgrade", "touch-stick"])
    el(id).classList.add("hidden");
  el("intro").classList.remove("hidden");
  menu.enter(canResume);
}
function restart() {
  if (coop.active) {
    coop.again();
    return;
  }
  s = createState(getRunConfig());
  scene.clear();
  keys.clear();
  stopStick();
  el("modal").classList.add("hidden");
  start();
}
let helpStep = 0;
function renderHelp() {
  const steps = [...el("help-content").querySelectorAll("dl > div")];
  steps.forEach((step, i) => step.classList.toggle("hidden", i !== helpStep));
  el("help-page").textContent = `${helpStep + 1} / ${steps.length}`;
  el<HTMLButtonElement>("help-previous").disabled = helpStep === 0;
  el<HTMLButtonElement>("help-next").disabled = helpStep === steps.length - 1;
}
el("help-previous").addEventListener("click", () => {
  helpStep = Math.max(0, helpStep - 1);
  renderHelp();
});
el("help-next").addEventListener("click", () => {
  helpStep = Math.min(4, helpStep + 1);
  renderHelp();
});
function renderModalText(help: boolean) {
  el("modal-title").textContent = t(help ? "HOW TO PLAY" : "PAUSED");
  el("modal-copy").textContent = t("Your run is on hold.");
  el("resume-label").textContent = t(
    help
      ? app.classList.contains("in-menu")
        ? "BACK"
        : "BACK TO THE YARD"
      : "CONTINUE",
  );
  el("resume-icon").innerHTML = svg(help ? "arrow" : "play");
  el("pause-time").textContent = format(s.time);
  el("pause-level").textContent = String(s.level);
  el("pause-kills").textContent = String(s.kills);
}
function openModal(help = false) {
  if (coop.active) {
    keys.clear();
    stopStick();
    coop.openMenu();
    return;
  }
  if (!loaded || s.phase === "upgrade" || s.phase === "lost") return;
  if (s.phase !== "paused" || app.classList.contains("in-menu")) {
    modalBefore = app.classList.contains("in-menu") ? "ready" : "playing";
    lastFocus = document.activeElement as HTMLElement;
  }
  s.phase = "paused";
  el("yard").classList.remove("is-playing");
  keys.clear();
  stopStick();
  renderModalText(help);
  el("modal").classList.toggle("is-help", help);
  helpStep = 0;
  renderHelp();
  el("help-content").classList.toggle("hidden", !help);
  el("modal").classList.remove("hidden");
  el("resume").focus({ preventScroll: true });
}
function closeModal() {
  if (s.phase !== "paused" || document.hidden) return;
  el("modal").classList.add("hidden");
  s.phase =
    app.classList.contains("in-menu") && s.time > 0 ? "paused" : modalBefore;
  el("yard").classList.toggle("is-playing", s.phase === "playing");
  lastFocus?.focus({ preventScroll: true });
}
el("pause-menu").addEventListener("click", returnToMenu);
el("result-menu").addEventListener("click", returnToMenu);
el("again").addEventListener("click", restart);
el("restart").addEventListener("click", restart);
el("resume").addEventListener("click", closeModal);
el("pause").addEventListener("click", () =>
  s.phase === "paused" ? closeModal() : openModal(),
);
el("help").addEventListener("click", () => openModal(true));
function toggleSound() {
  sound = !sound;
  el("sound").innerHTML = svg(sound ? "sound" : "mute");
  el("sound").setAttribute("aria-pressed", String(sound));
  el("sound").setAttribute(
    "aria-label",
    sound ? t("Mute sound") : t("Enable sound"),
  );
  if (sound) beep(600);
  menu.refresh();
}
el("sound").addEventListener("click", toggleSound);
window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (coop.lobbyOpen || ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
  if (coop.active && !e.repeat) {
    const index = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
    const numpad = ["Numpad1", "Numpad2", "Numpad3"].indexOf(e.code);
    if (index >= 0 || numpad >= 0) {
      e.preventDefault();
      coop.chooseKey(Math.max(index, numpad));
      return;
    }
  }
  if (
    app.classList.contains("in-menu") &&
    el("modal").classList.contains("hidden") &&
    menu.isHome() &&
    ["ArrowUp", "ArrowDown"].includes(e.key)
  ) {
    e.preventDefault();
    const buttons = [
      ...el("menu-home").querySelectorAll<HTMLButtonElement>("button"),
    ].filter((button) => button.getClientRects().length > 0);
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    buttons[
      (current +
        (e.key === "ArrowDown" ? 1 : buttons.length - 1) +
        buttons.length) %
        buttons.length
    ]?.focus();
    return;
  }
  if (e.key === "Tab") {
    trapFocus(e);
    return;
  }
  if (
    e.key === "Escape" &&
    app.classList.contains("in-menu") &&
    el("modal").classList.contains("hidden")
  ) {
    e.preventDefault();
    menu.back();
    return;
  }
  if (e.key === "Escape") {
    if (s.phase === "paused") closeModal();
    else if (s.phase === "playing") openModal();
    return;
  }
  if (s.phase === "upgrade") {
    if (
      ["Space", "Enter"].includes(e.code) &&
      (e.repeat || performance.now() < upgradeReadyAt)
    )
      e.preventDefault();
    if (["ArrowUp", "ArrowDown"].includes(e.code)) {
      e.preventDefault();
      const choices = [
        ...el("upgrade-choices").querySelectorAll<HTMLButtonElement>("button"),
      ];
      const current = choices.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      choices[
        (current +
          (e.code === "ArrowDown" ? 1 : choices.length - 1) +
          choices.length) %
          choices.length
      ]?.focus({ preventScroll: true });
      return;
    }
    const index = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
    const numpad = ["Numpad1", "Numpad2", "Numpad3"].indexOf(e.code);
    if (index >= 0 || numpad >= 0) {
      e.preventDefault();
      if (!e.repeat) pickUpgrade(s.choices[Math.max(index, numpad)]);
    }
    return;
  }
  const isButton = target.tagName === "BUTTON";
  if ((e.code === "Space" || e.code === "Enter") && isButton) return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.code === "Space" && !e.repeat) {
    if (s.phase === "ready" && menu.isHome()) start();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  stopStick();
  if (coop.active) {
    coop.stopInput();
    return;
  }
  // Mobile browser chrome can take focus during a gesture without hiding the game.
  // Actual app/tab switches are handled by visibilitychange below.
  if (s.phase === "playing" && (!touch || document.hidden)) openModal();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    stopStick();
    if (coop.active) coop.stopInput();
    else if (s.phase === "playing") openModal();
  }
});
function trapFocus(e: KeyboardEvent) {
  const panel = !el("upgrade").classList.contains("hidden")
    ? el("upgrade")
    : !el("modal").classList.contains("hidden")
      ? el("modal")
      : !el("result").classList.contains("hidden")
        ? el("result")
        : null;
  if (!panel) return;
  const buttons = [
    ...panel.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
  ].filter((button) => button.getClientRects().length > 0);
  const first = buttons[0],
    end = buttons.at(-1);
  if (!panel.contains(document.activeElement)) {
    e.preventDefault();
    first?.focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    end?.focus();
  } else if (!e.shiftKey && document.activeElement === end) {
    e.preventDefault();
    first.focus();
  }
}
let joystickId: number | null = null,
  joystickCenter = { x: 0, y: 0 };
const joy = el("touch-stick");
const arena = el("yard");
arena.addEventListener("pointerdown", (e) => {
  if (
    s.phase !== "playing" ||
    joystickId !== null ||
    (e.pointerType !== "touch" && e.target !== joy) ||
    (e.target as Element).closest(
      "button, .modal-backdrop, .result, .upgrade, .coop-lobby, .coop-upgrades",
    )
  )
    return;
  e.preventDefault();
  joystickId = e.pointerId;
  joy.classList.add("is-dragging");
  arena.setPointerCapture(e.pointerId);
  if (joy.contains(e.target as Node)) {
    const r = joy.getBoundingClientRect();
    joystickCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else {
    const r = arena.getBoundingClientRect();
    joystickCenter = { x: e.clientX, y: e.clientY };
    joy.style.left = `${e.clientX - r.left - joy.offsetWidth / 2}px`;
    joy.style.top = `${e.clientY - r.top - joy.offsetHeight / 2}px`;
    joy.style.bottom = "auto";
  }
  moveStick(e);
});
function moveStick(e: PointerEvent) {
  if (e.pointerId !== joystickId) return;
  const x = (e.clientX - joystickCenter.x) / 38,
    z = (e.clientY - joystickCenter.y) / 38;
  const l = Math.max(1, Math.hypot(x, z));
  stick = { x: x / l, z: z / l };
  (joy.firstElementChild as HTMLElement).style.transform =
    `translate(${stick.x * 30}px, ${stick.z * 30}px)`;
}
arena.addEventListener("pointermove", moveStick);
function stopStick() {
  const pointerId = joystickId;
  joystickId = null;
  joy.classList.remove("is-dragging");
  stick = { x: 0, z: 0 };
  (joy.firstElementChild as HTMLElement).style.transform = "";
  joy.style.left = "";
  joy.style.top = "";
  joy.style.bottom = "";
  if (pointerId !== null && arena.hasPointerCapture(pointerId)) {
    arena.releasePointerCapture(pointerId);
  }
}
function endStick(e: PointerEvent) {
  if (e.pointerId === joystickId) stopStick();
}
arena.addEventListener("pointerup", endStick);
arena.addEventListener("pointercancel", endStick);
arena.addEventListener("lostpointercapture", endStick);
// Also suppress scrolling in browsers that still start a native touch gesture.
arena.addEventListener(
  "touchmove",
  (e) => {
    if (s.phase === "playing" && e.cancelable) e.preventDefault();
  },
  { passive: false },
);
const format = (t: number) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
const abilityIcons: Record<UpgradeId, keyof typeof icons> = {
  saw: "nut",
  lightning: "bolt",
  turret: "turret",
  burst: "burst",
  boots: "boots",
  magnet: "magnet",
  armor: "shield",
  repair: "repair",
  refill: "magnet",
  overclock: "bolt",
};
function ownedAbilities() {
  return (Object.keys(s.upgrades) as UpgradeId[]).filter(
    (id) => Number.isFinite(UPGRADES[id].maxRank) && s.upgrades[id] > 0,
  );
}
function pickUpgrade(id: UpgradeId | undefined) {
  if (
    !id ||
    s.phase !== "upgrade" ||
    document.hidden ||
    performance.now() < upgradeReadyAt
  )
    return;
  if (!chooseUpgrade(s, id)) return;
  keys.clear();
  stopStick();
  shownUpgrade = "";
  el("upgrade").classList.add("hidden");
  el("yard").classList.toggle("is-playing", s.choices.length === 0);
  // Do not leave keyboard focus on a hidden choice, where a held key could fire again.
  el("yard").focus({ preventScroll: true });
  beep(720, 0.14, "triangle");
  renderUpgrades();
}
function renderUpgrades() {
  const loadout =
    ownedAbilities()
      .map((id) => `${id}:${s.upgrades[id]}`)
      .join("|") + Object.values(s.evolutions).join();
  if (loadout !== shownLoadout) {
    shownLoadout = loadout;
    el("ability-loadout").innerHTML = ownedAbilities()
      .map((id) => {
        const evolution = (Object.keys(EVOLUTIONS) as EvolutionId[]).find(
          (key) => s.evolutions[key] && EVOLUTIONS[key].weapon === id,
        );
        const name = evolution
          ? t(EVOLUTIONS[evolution].name)
          : upgradeName(id);
        return `<span class="ability-chip${evolution ? " is-evolved" : ""}" title="${t("{name}, rank {rank}", { name, rank: s.upgrades[id] })}" aria-label="${t("{name}, rank {rank}", { name, rank: s.upgrades[id] })}">${svg(abilityIcons[id])}<b>${s.upgrades[id]}</b></span>`;
      })
      .join("");
  }
  if (coop.active || s.phase !== "upgrade") return;
  const signature = `${s.level}:${s.choices.join(",")}:${loadout}`;
  if (signature === shownUpgrade) return;
  shownUpgrade = signature;
  upgradeReadyAt = performance.now() + 250;
  keys.clear();
  stopStick();
  el("yard").classList.remove("is-playing");
  el("modal").classList.add("hidden");
  el("upgrade-copy").textContent = t("Level {level} · Choose one upgrade.", {
    level: s.level,
  });
  el("upgrade-choices").innerHTML = upgradeChoicesMarkup(s);
  el("upgrade").classList.remove("hidden");
  el("upgrade-choices")
    .querySelector<HTMLButtonElement>("button")
    ?.focus({ preventScroll: true });
  beep(480, 0.18, "triangle");
}
el("upgrade-choices").addEventListener("click", (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>(
    "button[data-upgrade]",
  );
  if (button) pickUpgrade(button.dataset.upgrade as UpgradeId);
});
let shownOpening = "";
function renderOpeningGuide() {
  const visible =
    s.phase === "playing" && !app.classList.contains("in-menu") && s.time < 3;
  el("opening-guide").classList.toggle("hidden", !visible);
  if (!visible) return;
  // Keep the explanation readable even when the first volley follows collection immediately.
  const phase = s.scrap > 0 || s.launched > 0 ? "orbit" : "collect";
  const signature = `${phase}:${getLanguage()}`;
  if (signature === shownOpening) return;
  shownOpening = signature;
  el("opening-guide").dataset.step = phase;
  el("opening-copy").textContent = t(
    phase === "collect"
      ? "Your magnet collects nearby scrap."
      : "Scrap orbits you, then fires automatically.",
  );
}
let worldHintMarkup = "";
let hintRun = "";
const hintStarted = new Map<string, number>();
// Presentation time prevents pausing/revisiting from reviving a dismissed hint.
// Keys are ability/discovery kinds, so this stays bounded in endless runs.
function briefHint(key: string, duration = 1800) {
  if (hintRun !== runId) {
    hintRun = runId;
    hintStarted.clear();
  }
  const now = performance.now();
  if (!hintStarted.has(key)) hintStarted.set(key, now);
  return now - hintStarted.get(key)! < duration;
}
function renderExpansionHUD() {
  const playing = s.phase === "playing" && !app.classList.contains("in-menu");
  const boss =
    s.encounters.active &&
    s.enemies.find((e) => e.id === s.encounters.active!.id && e.hp > 0);
  el("boss-hud").classList.toggle("hidden", !playing || !boss);
  if (boss && s.encounters.active) {
    el("boss-name").textContent = t(
      boss.type === "boss" ? "Yard Titan" : "Crusher",
    );
    el("boss-fill").style.transform =
      `scaleX(${Math.max(0, boss.hp / s.encounters.active.maxHp)})`;
    el("boss-health").setAttribute(
      "aria-label",
      t(boss.type === "boss" ? "Yard Titan" : "Crusher"),
    );
    el("boss-health").setAttribute(
      "aria-valuemax",
      String(s.encounters.active.maxHp),
    );
    el("boss-health").setAttribute("aria-valuenow", String(Math.ceil(boss.hp)));
  }
  let text = "";
  let markup = "";
  let compact = false;
  let hintProgress: number | undefined;
  if (
    playing &&
    s.evolutionNotice &&
    s.evolutionNotice.until > s.time &&
    briefHint(`evolution:${s.evolutionNotice.id}`)
  ) {
    text = t("EVOLVED: {name}", {
      name: t(EVOLUTIONS[s.evolutionNotice.id].name),
    });
  } else if (playing) {
    const hint = getDiscoveryHint(s);
    if (
      hint &&
      (s.time >= 3 || hint.mode === "hold" || hint.distance <= 3) &&
      (hint.mode === "hold" || briefHint(`discovery:${hint.kind}`))
    ) {
      const status =
        hint.mode === "hold"
          ? t("{name} · {seconds}s", {
              name: t(
                hint.kind === "salvage"
                  ? "Hold the zone"
                  : "Stay nearby to open",
              ),
              seconds: hint.seconds,
            })
          : hint.mode === "full-health"
            ? t("Health is full")
            : t("{name} · {distance} m", {
                name: t(discoveryNames[hint.kind]),
                distance: Math.ceil(hint.distance),
              });
      hintProgress = hint.mode === "hold" ? hint.progress : undefined;
      compact = hint.mode === "hold";
      markup = compact
        ? discoveryProgress(hint.kind, status, 0)
        : discoveryFeedback(hint.kind, status);
    }
  }
  const worldHint = el("world-hint");
  worldHint.classList.toggle("hidden", !text && !markup);
  worldHint.classList.toggle("is-discovery", Boolean(markup));
  worldHint.classList.remove("is-reward");
  worldHint.classList.toggle("is-compact", compact);
  if (markup) {
    if (worldHintMarkup !== markup) {
      worldHint.innerHTML = markup;
      worldHintMarkup = markup;
    }
    if (hintProgress !== undefined) {
      const meter = worldHint.querySelector<HTMLElement>(".discovery-progress");
      meter?.setAttribute(
        "aria-valuenow",
        String(Math.round(hintProgress * 100)),
      );
      const fill = meter?.querySelector<HTMLElement>("i");
      if (fill) fill.style.transform = `scaleX(${hintProgress})`;
    }
  } else {
    worldHintMarkup = "";
    if (worldHint.textContent !== text) worldHint.textContent = text;
  }
  if (text || markup) el("opening-guide").classList.add("hidden");
}
function hud() {
  renderOpeningGuide();
  renderExpansionHUD();
  if (app.dataset.phase !== s.phase) app.dataset.phase = s.phase;
  el("timer").textContent = format(s.time);
  el("wave").textContent = t("PRESSURE {wave}", { wave: s.wave });
  el("level").textContent = t("LV. {level}", { level: s.level });
  el("xp-label").textContent = t("{xp} / {needed} XP", {
    xp: s.xp,
    needed: s.xpNeeded,
  });
  el("xp-current-level").textContent = t("LV. {level}", { level: s.level });
  el("xp-next-level").textContent = t("LV. {level}", { level: s.level + 1 });
  el("xp-meter-count").textContent = t("{xp} / {needed} XP", {
    xp: s.xp,
    needed: s.xpNeeded,
  });
  el("health-value").textContent = `${Math.ceil(s.hp)} / 100`;
  el("health-fill").style.transform = `scaleX(${s.hp / 100})`;
  el("yard").classList.toggle("low-health", s.hp <= 25);
  document
    .querySelector(".health-track")!
    .setAttribute("aria-valuenow", String(s.hp));
  el("kills").textContent = String(s.kills);
  el("xp-progress").style.transform =
    `scaleX(${Math.min(1, s.xp / s.xpNeeded)})`;
  const xpBar = document.querySelector(".top-progress")!;
  xpBar.setAttribute("aria-valuenow", String(Math.min(s.xp, s.xpNeeded)));
  xpBar.setAttribute("aria-valuemax", String(s.xpNeeded));
  xpBar.setAttribute(
    "aria-valuetext",
    t("Level {level}, {xp} of {needed} experience", {
      level: s.level,
      xp: s.xp,
      needed: s.xpNeeded,
    }),
  );
  renderUpgrades();
  el<HTMLButtonElement>("pause").disabled =
    s.phase !== "playing" && s.phase !== "paused";
  el<HTMLButtonElement>("help").disabled =
    s.phase === "upgrade" || s.phase === "lost";
  if (s.phase === "lost" && !showedResult) {
    showedResult = true;
    runReceipt ??= recordRun({
      runId,
      phase: s.phase,
      time: s.time,
      kills: s.kills,
      earnedParts: s.earnedParts,
    });
    el("result-reward").textContent = t("+{parts} parts · Bank: {total}", {
      parts: runReceipt?.earned ?? 0,
      total: runReceipt?.parts ?? 0,
    });
    document.querySelector(".result-unit")!.textContent = ROBOTS.find(
      (r) => r.id === s.config.robotId,
    )!.name;
    el("yard").classList.remove("is-playing");
    keys.clear();
    stopStick();
    el("upgrade").classList.add("hidden");
    el("result").classList.remove("hidden");
    el("result-stamp").textContent = t("BACK TO THE WORKSHOP");
    el("result-title").textContent = t("SHIFT COMPLETE");
    el("result-copy").textContent = t(
      "The swarm got this shift. {launches} scrap launches made it count.",
      { launches: s.launched },
    );
    el("result-kills").textContent = String(s.kills);
    el("result-time").textContent = format(s.time);
    el("result-level").textContent = String(s.level);
    el("result-build").innerHTML = resultBuildMarkup(s);
    el("again").focus({ preventScroll: true });
    beep(120, 0.3);
  }
}
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const m = {
    x:
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft")) +
      stick.x,
    z:
      Number(keys.has("KeyS") || keys.has("ArrowDown")) -
      Number(keys.has("KeyW") || keys.has("ArrowUp")) +
      stick.z,
  };
  if (coop.active) coop.input(m, now);
  else update(s, dt, m);
  if (s.events.length) {
    scene.events(s.events, s);
    if (s.events.some((event) => event.kind === "launch"))
      beep(160, 0.22, "sawtooth", 0.026);
    const e = s.events.find(
      (e) => e.kind === "kill" || e.kind === "hurt" || e.kind === "collect",
    );
    if (e?.kind === "kill") beep(240, 0.07, "triangle");
    else if (e?.kind === "hurt") beep(80, 0.12, "triangle");
    else if (e) beep(650, 0.025, "sine", 0.009);
    s.events = [];
  }
  scene.renderPartner(coop.active ? coop.partner : null, dt);
  scene.render(
    coop.active ? coop.presentation(s, dt) : s,
    s.phase === "playing" ? dt : 0,
  );
  hud();
  requestAnimationFrame(loop);
}
async function boot() {
  let loadFailed = false;
  try {
    await document.fonts.ready;
    scene = new YardScene(el("yard"));
    scene.renderer.domElement.setAttribute(
      "aria-label",
      t(
        "Junk Magnet 3D scrapyard. Move with WASD, arrow keys, or touch. Attacks are automatic.",
      ),
    );
    await scene.load((n) => {
      if (loadFailed) return;
      const percent = Math.round(n * 100);
      el("load-progress").style.transform = `scaleX(${n})`;
      el("load-meter").setAttribute("aria-valuenow", String(percent));
      el("load-percent").textContent = `${percent}%`;
      el("load-detail").textContent = t(
        n < 1 ? "Unpacking the good junk." : "Opening the yard…",
      );
    });
    loaded = true;
    el("loading").classList.add("hidden");
    el("intro").classList.remove("hidden");
    menu.enter(false);
    new ResizeObserver(() => scene.resize()).observe(el("yard"));
    requestAnimationFrame(loop);
    // Read-only state snapshot for browser QA, without gameplay mutation hooks.
    Object.defineProperty(window, "__JUNK_MAGNET__", {
      value: {
        snapshot: () => ({
          coop: {
            active: coop.active,
            code: coop.code,
            index: coop.index,
            down: coop.down,
            partner: coop.partner
              ? { player: { ...coop.partner.player }, hp: coop.partner.hp }
              : null,
          },
          phase: s.phase,
          time: s.time,
          openingRemaining: s.openingRemaining,
          robot: { ...s.config },
          earnedParts: s.earnedParts,
          evolutions: { ...s.evolutions },
          boss: s.encounters.active ? { ...s.encounters.active } : null,
          encounterWarnings: s.encounters.warnings.map((w) => ({ ...w })),
          hostileShots: s.encounters.projectiles.length,
          dangerZones: s.encounters.zones.length,
          discoveries: s.discovery.points.map((p) => ({ ...p })),
          discoveryReward: s.discovery.lastReward
            ? { ...s.discovery.lastReward }
            : null,
          chestsOpened: s.discovery.chestsOpened,
          questsCompleted: s.discovery.questsCompleted,
          receipt: runReceipt ? { ...runReceipt } : null,
          player: { ...s.player },
          aim: { ...s.aim },
          facing: { ...s.facing },
          level: s.level,
          xp: s.xp,
          xpNeeded: s.xpNeeded,
          choices: [...s.choices],
          upgrades: { ...s.upgrades },
          enemyCount: s.enemies.length,
          enemies: s.enemies.map(({ x, z, type, hp }) => ({ x, z, type, hp })),
          scrapDrops: s.pickups
            .filter((p) => p.kind === "scrap")
            .slice(0, 120)
            .map(({ x, z }) => ({ x, z })),
          xpDrops: s.pickups
            .filter((p) => p.kind === "xp")
            .slice(0, 120)
            .map(({ x, z }) => ({ x, z })),
          enemyTypes: s.enemies.reduce<Record<string, number>>(
            (counts, enemy) => {
              counts[enemy.type] = (counts[enemy.type] ?? 0) + 1;
              return counts;
            },
            {},
          ),
          turrets: s.turrets.length,
          world: scene.diagnostics(),
          hp: s.hp,
          scrap: s.scrap,
          kills: s.kills,
          spawned: s.spawned,
          shots: s.shots.length,
          pickups: s.pickups.length,
          launched: s.launched,
          drawCalls: scene.renderer.info.render.calls,
          triangles: scene.renderer.info.render.triangles,
        }),
      },
    });
  } catch (error) {
    loadFailed = true;
    console.error(error);
    el("loading").classList.add("has-error");
    el("load-title").textContent = t("The yard couldn’t open.");
    el("load-detail").textContent = t(
      "A 3D asset or WebGL failed to load. Please reload in a browser with hardware acceleration enabled.",
    );
    el("reload").classList.remove("hidden");
    el("reload").addEventListener("click", () => location.reload());
  }
}
function applyLanguage() {
  coop.refresh();
  menu.refresh();
  document.documentElement.lang = getLanguage();
  translateStatic();
  const currentLanguage = LANGUAGES.find(
    (entry) => entry.code === getLanguage(),
  )!;
  el("language").innerHTML =
    `${languageFlag(currentLanguage.code)}<span>${currentLanguage.code.toUpperCase()}</span>`;
  el("language").setAttribute(
    "aria-label",
    `${t("Language")}: ${currentLanguage.name}`,
  );
  el("language").title = currentLanguage.name;
  el("sound").setAttribute(
    "aria-label",
    t(sound ? "Mute sound" : "Enable sound"),
  );
  document.querySelector<HTMLElement>(".workbench")!.dataset.touchHint = t(
    "DRAG TO MOVE · AUTO ATTACK",
  );
  document.querySelector<HTMLElement>(".intro-note")!.dataset.touchHint = t(
    "Drag anywhere in the yard · Attacks are automatic",
  );
  scene?.renderer.domElement.setAttribute(
    "aria-label",
    t(
      "Junk Magnet 3D scrapyard. Move with WASD, arrow keys, or touch. Attacks are automatic.",
    ),
  );
  if (s.phase === "paused") {
    const help = !el("help-content").classList.contains("hidden");
    renderModalText(help);
  }
  shownLoadout = "";
  shownUpgrade = "";
  if (s.phase === "lost") showedResult = false;
  hud();
}
function chooseLanguage(next: Language) {
  setLanguage(next);
  applyLanguage();
}
function toggleLanguage() {
  const index = LANGUAGES.findIndex((entry) => entry.code === getLanguage());
  chooseLanguage(LANGUAGES[(index + 1) % LANGUAGES.length].code);
}
function chooseQuality(next: GraphicsQuality) {
  setGraphicsQuality(next);
  scene?.setQuality(next);
  menu.refresh();
}
el("language").addEventListener("click", toggleLanguage);
const menu = setupMenu({
  start,
  restart,
  help: () => openModal(true),
  language: chooseLanguage,
  quality: chooseQuality,
  sound: toggleSound,
  soundEnabled: () => sound,
});
const coop = new CoopClient({
  snapshot(packet, first) {
    const events = [...s.events, ...packet.events].slice(-160);
    s = packet.state;
    s.events = events;
    if (first) {
      runId = packet.runId as typeof runId;
      runReceipt = null;
      showedResult = false;
      shownUpgrade = "";
      shownLoadout = "";
      scene.clear();
      keys.clear();
      stopStick();
      app.classList.remove("in-menu");
      app.classList.add("in-run");
      el("yard").classList.add("is-playing");
      el("pause").innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 6h14M5 12h14M5 18h14"/></svg>';
      el("pause").setAttribute("aria-label", ct("menu"));
      for (const id of ["intro", "modal", "result", "upgrade"])
        el(id).classList.add("hidden");
      if (touch) el("touch-stick").classList.remove("hidden");
      el("yard").focus({ preventScroll: true });
    }
    el<HTMLButtonElement>("again").disabled = coop.index !== 0;
    el("again").querySelector("span")!.textContent = ct(
      coop.index === 0 ? "again" : "hostAgain",
    );
  },
  leave() {
    s = createState(getRunConfig());
    scene.clear();
    el<HTMLButtonElement>("again").disabled = false;
    el("again").querySelector("span")!.textContent = t("ONE MORE SHIFT");
    returnToMenu();
  },
});
applyLanguage();
void boot();
