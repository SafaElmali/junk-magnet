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
import {
  t,
  getLanguage,
  setLanguage,
  bindStaticTranslations,
  upgradeName,
  localizedUpgradeDescription,
} from "./i18n";
import { YardScene } from "./scene";
import {
  createState,
  update,
  launch,
  MAX_SCRAP,
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
 <div class="top-progress" role="progressbar" aria-label="Experience toward next level" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0"><i id="xp-progress"></i></div>
 <section class="hud" aria-label="Game status">
  <div class="health-panel"><div class="robot-badge">${svg("magnet")}</div><div class="health-copy"><div class="health-heading"><strong id="level">LV. 1</strong><span id="health-value">100 / 100</span></div><div class="health-track" role="progressbar" aria-label="Robot health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="health-fill"></i></div></div></div>
  <div class="timer-panel"><strong id="timer">00:00</strong><span id="wave">PRESSURE 1</span></div>
  <div class="salvage-panel">${svg("nut")}<div><strong id="kills">0</strong><span class="hud-label">JUNK RECYCLED</span></div></div>
 </section>
 <div class="yard-caption"><span id="xp-label">0 / 5 XP</span><i></i><span>COLLECT BLUE ENERGY. BUILD SOMETHING BIGGER.</span></div>
 <div id="ability-loadout" class="ability-loadout" aria-label="Current abilities"></div>
 <div class="load-state" id="loading" role="status"><div class="loading-magnet">${svg("magnet")}</div><h2>Opening the yard…</h2><p id="load-detail">Unpacking the good junk.</p><div class="load-track"><i id="load-progress"></i></div></div>
 <div class="intro hidden" id="intro"><div class="intro-content"><h2>Small robot.<br>Endless trouble.</h2><p>Keep moving. Your weapons fire automatically.<br>Collect blue energy to level up.<br><strong>Choose upgrades. Survive the swarm.</strong></p><button class="primary-btn" id="start">LET’S MAKE A MESS ${svg("arrow")}</button><span class="intro-note">Move with WASD or arrows · Space to launch</span></div></div>
 <div class="lower-hud hidden" id="lower-hud"><div class="orbit-panel"><div class="orbit-icon">${svg("magnet")}</div><div><div class="orbit-caption"><strong>SCRAP ORBIT</strong><span id="scrap-count">6 / 12</span></div><div class="scrap-pips" id="scrap-pips">${Array.from({ length: 12 }, () => "<i></i>").join("")}</div></div></div><div class="hint" id="hint" role="status">Your orbit attacks automatically. Get close to loose scrap.</div><button id="launch" class="launch-btn">${svg("magnet")}<span><strong>LAUNCH SCRAP</strong><small id="launch-note">SPACE / CLICK</small></span></button></div>
 <div class="touch-stick hidden" id="touch-stick" aria-label="Movement joystick"><div></div></div>
 <div class="modal-backdrop hidden" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-card"><div class="modal-symbol">${svg("magnet")}</div><h2 id="modal-title">Taking a breather.</h2><p id="modal-copy"></p><div id="help-content" class="hidden"><dl><div><dt>Move</dt><dd>WASD / arrow keys, or drag anywhere in the yard.</dd></div><div><dt>Collect</dt><dd>Get near silver scrap. It joins your orbit and attacks automatically.</dd></div><div><dt>Launch</dt><dd>Aim with the pointer, then click or press Space. Without a pointer, move toward your target first.</dd></div><div><dt>Upgrade</dt><dd>Collect blue energy. Each level pauses the yard: choose one of three abilities with a tap or keys 1–3.</dd></div><div><dt>Recover</dt><dd>Your automatic pulse keeps firing when the orbit is empty. Collect wreckage to rebuild.</dd></div></dl></div><button class="primary-btn" id="resume">BACK TO THE YARD ${svg("arrow")}</button><button class="text-btn" id="restart">Start a fresh shift</button></div></div>
 <div class="upgrade hidden" id="upgrade" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><div class="upgrade-sheet"><h2 id="upgrade-title">Make room for more trouble.</h2><p id="upgrade-copy">Level 2 · Pick one upgrade. The yard is paused.</p><div id="upgrade-choices" class="upgrade-choices"></div><p class="upgrade-note">Choose with 1, 2, or 3 · Your other abilities keep their upgrades.</p></div></div>
 <div class="result hidden" id="result" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="modal-card"><div class="result-stamp" id="result-stamp">SHIFT COMPLETE</div><h2 id="result-title">That's good junk.</h2><p id="result-copy"></p><div class="result-stats"><div><strong id="result-kills"></strong><span>JUNK RECYCLED</span></div><div><strong id="result-time"></strong><span>SHIFT TIME</span></div><div><strong id="result-level"></strong><span>LEVEL REACHED</span></div></div><p class="result-build" id="result-build"></p><button class="primary-btn" id="again">ONE MORE SHIFT ${svg("reset")}</button></div></div>
</main>
<footer class="workbench"><div class="controls"><span><kbd>W</kbd><span class="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><strong>MOVE</strong><i></i><span class="mouse-icon"></span><strong>AIM</strong><i></i><kbd class="space-key">SPACE</kbd><strong>LAUNCH</strong></div><p><span class="footer-dot"></span> ONE ROBOT. ENDLESS POTENTIAL.</p><span class="prototype-label">ENDLESS SURVIVAL <b>v0.2</b></span></footer>`;
const translateStatic = bindStaticTranslations(app);
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let s = createState(),
  scene: YardScene,
  loaded = false,
  last = 0,
  sound = false,
  modalBefore: "ready" | "playing" = "playing",
  lastFocus: HTMLElement | null = null;
const keys = new Set<string>();
let stick: Vec = { x: 0, z: 0 },
  pointerAim = false,
  showedResult = false,
  audio: AudioContext | undefined;
let shownUpgrade = "",
  shownLoadout = "",
  upgradeReadyAt = 0;
const pips = [...document.querySelectorAll<HTMLElement>(".scrap-pips i")];
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
  if (!loaded) return;
  s.phase = "playing";
  el("yard").classList.add("is-playing");
  showedResult = false;
  el("intro").classList.add("hidden");
  el("result").classList.add("hidden");
  el("upgrade").classList.add("hidden");
  shownUpgrade = "";
  el("lower-hud").classList.remove("hidden");
  el<HTMLButtonElement>("pause").disabled = false;
  if (touch) el("touch-stick").classList.remove("hidden");
  beep(320, 0.12);
}
function restart() {
  s = createState();
  scene.clear();
  keys.clear();
  pointerAim = false;
  stopStick();
  el("modal").classList.add("hidden");
  start();
}
function openModal(help = false) {
  if (!loaded || s.phase === "upgrade" || s.phase === "lost") return;
  if (s.phase !== "paused") {
    modalBefore = s.phase === "ready" ? "ready" : "playing";
    lastFocus = document.activeElement as HTMLElement;
  }
  s.phase = "paused";
  el("yard").classList.remove("is-playing");
  keys.clear();
  stopStick();
  el("modal-title").textContent = help
    ? t("A little scrap goes a long way.")
    : t("Taking a breather.");
  el("modal-copy").textContent = help
    ? t(
        "The scrapyard keeps going. Collect blue energy, build your abilities, and survive as long as you can.",
      )
    : t("The yard can wait. Your orbit and the swarm are paused.");
  el("help-content").classList.toggle("hidden", !help);
  el("modal").classList.remove("hidden");
  el("resume").focus({ preventScroll: true });
}
function closeModal() {
  if (s.phase !== "paused" || document.hidden) return;
  el("modal").classList.add("hidden");
  s.phase = modalBefore;
  el("yard").classList.toggle("is-playing", s.phase === "playing");
  lastFocus?.focus({ preventScroll: true });
}
function doLaunch() {
  if (launch(s)) beep(160, 0.22, "sawtooth", 0.026);
}
el("start").addEventListener("click", start);
el("again").addEventListener("click", restart);
el("restart").addEventListener("click", restart);
el("resume").addEventListener("click", closeModal);
el("pause").addEventListener("click", () =>
  s.phase === "paused" ? closeModal() : openModal(),
);
el("help").addEventListener("click", () => openModal(true));
el("launch").addEventListener("click", doLaunch);
// A second touch does not reliably generate a click while the movement finger is held.
el("launch").addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    doLaunch();
  },
  { passive: false },
);
el("sound").addEventListener("click", () => {
  sound = !sound;
  el("sound").innerHTML = svg(sound ? "sound" : "mute");
  el("sound").setAttribute("aria-pressed", String(sound));
  el("sound").setAttribute(
    "aria-label",
    sound ? t("Mute sound") : t("Enable sound"),
  );
  if (sound) beep(600);
});
window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (e.key === "Tab") {
    trapFocus(e);
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
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  )
    pointerAim = false;
  keys.add(e.code);
  if (e.code === "Space" && !e.repeat) {
    if (s.phase === "ready") start();
    else doLaunch();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  stopStick();
  // Mobile browser chrome can take focus during a gesture without hiding the game.
  // Actual app/tab switches are handled by visibilitychange below.
  if (s.phase === "playing" && (!touch || document.hidden)) openModal();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    stopStick();
    if (s.phase === "playing") openModal();
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
  ];
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
    (e.target as Element).closest("button, .modal-backdrop, .result, .upgrade")
  )
    return;
  e.preventDefault();
  joystickId = e.pointerId;
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
  pointerAim = false;
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
  const loadout = ownedAbilities()
    .map((id) => `${id}:${s.upgrades[id]}`)
    .join("|");
  if (loadout !== shownLoadout) {
    shownLoadout = loadout;
    el("ability-loadout").innerHTML = ownedAbilities()
      .map(
        (id) =>
          `<span class="ability-chip" title="${t("{name}, rank {rank}", { name: upgradeName(id), rank: s.upgrades[id] })}" aria-label="${t("{name}, rank {rank}", { name: upgradeName(id), rank: s.upgrades[id] })}">${svg(abilityIcons[id])}<b>${s.upgrades[id]}</b></span>`,
      )
      .join("");
  }
  if (s.phase !== "upgrade") return;
  const signature = `${s.level}:${s.choices.join(",")}:${loadout}`;
  if (signature === shownUpgrade) return;
  shownUpgrade = signature;
  upgradeReadyAt = performance.now() + 250;
  keys.clear();
  stopStick();
  el("yard").classList.remove("is-playing");
  el("modal").classList.add("hidden");
  el("upgrade-copy").textContent = t(
    "Level {level} · Pick one upgrade. The yard is paused.",
    { level: s.level },
  );
  el("upgrade-choices").innerHTML = s.choices
    .map((id, index) => {
      const rank = s.upgrades[id];
      const label = !Number.isFinite(UPGRADES[id].maxRank)
        ? id === "overclock"
          ? t("20-SECOND BOOST")
          : id === "repair"
            ? t("INSTANT REPAIR")
            : t("INSTANT REFILL")
        : rank
          ? t("RANK {rank} → {next}", { rank, next: rank + 1 })
          : t("NEW ABILITY");
      return `<button type="button" class="upgrade-choice" data-upgrade="${id}" data-choice="${index}"><span class="upgrade-icon">${svg(abilityIcons[id])}</span><span class="upgrade-text"><span class="upgrade-rank">${label}</span><strong>${upgradeName(id)}</strong><span class="upgrade-description">${localizedUpgradeDescription(s, id)}</span></span><kbd>${index + 1}</kbd></button>`;
    })
    .join("");
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
function hud() {
  el("timer").textContent = format(s.time);
  el("wave").textContent = t("PRESSURE {wave}", { wave: s.wave });
  el("level").textContent = t("LV. {level}", { level: s.level });
  el("xp-label").textContent = t("{xp} / {needed} XP", {
    xp: s.xp,
    needed: s.xpNeeded,
  });
  el("health-value").textContent = `${Math.ceil(s.hp)} / 100`;
  el("health-fill").style.transform = `scaleX(${s.hp / 100})`;
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
  el("scrap-count").textContent = `${s.scrap} / ${MAX_SCRAP}`;
  pips.forEach((p, i) => p.classList.toggle("filled", i < s.scrap));
  const launchButton = el<HTMLButtonElement>("launch");
  launchButton.disabled =
    s.phase !== "playing" || s.scrap === 0 || s.cooldown > 0;
  el("launch-note").textContent =
    s.cooldown > 0
      ? t("RECHARGING…")
      : s.scrap === 0
        ? t("COLLECT MORE SCRAP")
        : touch
          ? t("TAP TO RELEASE")
          : t("SPACE / CLICK");
  el("hint").textContent =
    s.scrap === 0
      ? t(
          "Empty orbit? Your pulse still fires. Collect silver wreckage to rebuild.",
        )
      : s.time < 15
        ? t(
            "Collect blue energy to level up. Your weapons attack automatically.",
          )
        : s.launched === 0
          ? t("Try launching your orbit through a crowd. Space or click.")
          : s.scrap === MAX_SCRAP
            ? t("Full scrap storm. Aim for a crowd and let it fly.")
            : t(
                "Blue energy upgrades your build. Silver scrap reloads your orbit.",
              );
  if (s.phase === "lost" && !showedResult) {
    showedResult = true;
    el("yard").classList.remove("is-playing");
    keys.clear();
    stopStick();
    el("upgrade").classList.add("hidden");
    el("result").classList.remove("hidden");
    el("result-stamp").textContent = t("BACK TO THE WORKSHOP");
    el("result-title").textContent = t("A few dents. No regrets.");
    el("result-copy").textContent = t(
      "The swarm got this shift. {launches} scrap launches made it count.",
      { launches: s.launched },
    );
    el("result-kills").textContent = String(s.kills);
    el("result-time").textContent = format(s.time);
    el("result-level").textContent = String(s.level);
    el("result-build").textContent = t("Your build: {build}", {
      build: ownedAbilities()
        .map((id) => `${upgradeName(id)} ${s.upgrades[id]}`)
        .join(" · "),
    });
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
  const len = Math.hypot(m.x, m.z);
  if (len > 0.1 && (!pointerAim || touch)) {
    s.aim = { x: m.x / len, z: m.z / len };
  }
  update(s, dt, m);
  if (s.events.length) {
    scene.events(s.events, s);
    const e = s.events.find(
      (e) => e.kind === "kill" || e.kind === "hurt" || e.kind === "collect",
    );
    if (e?.kind === "kill") beep(240, 0.07, "triangle");
    else if (e?.kind === "hurt") beep(80, 0.12, "triangle");
    else if (e) beep(650, 0.025, "sine", 0.009);
    s.events = [];
  }
  scene.render(s, s.phase === "playing" ? dt : 0);
  hud();
  requestAnimationFrame(loop);
}
async function boot() {
  try {
    await document.fonts.ready;
    scene = new YardScene(el("yard"));
    scene.renderer.domElement.setAttribute(
      "aria-label",
      t(
        "Junk Magnet 3D scrapyard. Move with WASD or arrow keys and launch scrap with Space.",
      ),
    );
    await scene.load((n) => {
      el("load-progress").style.transform = `scaleX(${n})`;
      el("load-detail").textContent = t(
        "Preparing the scrapyard… {progress}%",
        { progress: Math.round(n * 100) },
      );
    });
    loaded = true;
    el("loading").classList.add("hidden");
    el("intro").classList.remove("hidden");
    scene.renderer.domElement.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" || s.phase !== "playing") return;
      const p = scene.pointer(e.clientX, e.clientY);
      if (p) {
        const x = p.x - s.player.x,
          z = p.z - s.player.z,
          d = Math.hypot(x, z);
        if (d > 0.3) {
          pointerAim = true;
          s.aim = { x: x / d, z: z / d };
        }
      }
    });
    scene.renderer.domElement.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch" && e.button === 0) doLaunch();
    });
    new ResizeObserver(() => scene.resize()).observe(el("yard"));
    requestAnimationFrame(loop);
    // Read-only state snapshot for browser QA, without gameplay mutation hooks.
    Object.defineProperty(window, "__JUNK_MAGNET__", {
      value: {
        snapshot: () => ({
          phase: s.phase,
          time: s.time,
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
    console.error(error);
    el("loading").innerHTML =
      `<h2>${t("The yard couldn’t open.")}</h2><p>${t("A 3D asset or WebGL failed to load. Please reload in a browser with hardware acceleration enabled.")}</p><button class="primary-btn" id="reload">${t("TRY AGAIN")}</button>`;
    el("reload").addEventListener("click", () => location.reload());
  }
}
function applyLanguage() {
  document.documentElement.lang = getLanguage();
  translateStatic();
  el("language").textContent = getLanguage() === "en" ? "TR" : "EN";
  el("language").setAttribute(
    "aria-label",
    getLanguage() === "en" ? "Türkçeye geç" : "Switch to English",
  );
  el("language").title = getLanguage() === "en" ? "Türkçe" : "English";
  el("sound").setAttribute(
    "aria-label",
    t(sound ? "Mute sound" : "Enable sound"),
  );
  document.querySelector<HTMLElement>(".workbench")!.dataset.touchHint = t(
    "DRAG TO MOVE · TAP TO LAUNCH",
  );
  document.querySelector<HTMLElement>(".intro-note")!.dataset.touchHint = t(
    "Drag anywhere in the yard · Tap Launch to fire",
  );
  scene?.renderer.domElement.setAttribute(
    "aria-label",
    t(
      "Junk Magnet 3D scrapyard. Move with WASD or arrow keys and launch scrap with Space.",
    ),
  );
  if (s.phase === "paused") {
    const help = !el("help-content").classList.contains("hidden");
    el("modal-title").textContent = t(
      help ? "A little scrap goes a long way." : "Taking a breather.",
    );
    el("modal-copy").textContent = t(
      help
        ? "The scrapyard keeps going. Collect blue energy, build your abilities, and survive as long as you can."
        : "The yard can wait. Your orbit and the swarm are paused.",
    );
  }
  shownLoadout = "";
  shownUpgrade = "";
  if (s.phase === "lost") showedResult = false;
  hud();
}
el("language").addEventListener("click", () => {
  setLanguage(getLanguage() === "en" ? "tr" : "en");
  applyLanguage();
});
applyLanguage();
void boot();
