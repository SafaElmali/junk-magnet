import { getRunConfig } from "./progression";
import { track } from "./analytics";
import { ct } from "./coop-text";
import { upgradeChoicesMarkup } from "./level-up";
import type { CoopSnapshot } from "./coop-session";
import type { State, Vec, UpgradeId } from "./simulation";
import "./coop.css";

const groupIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="8" cy="7" r="3"/><path d="M2 21v-5a6 6 0 0 1 12 0v5M16 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 5 5v2"/></svg>';
export class CoopClient {
  active = false;
  lobbyOpen = false;
  index = 0;
  code = "";
  partner: CoopSnapshot["partner"] | null = null;
  down = false;
  private socket?: WebSocket;
  private runId = "";
  private lastPacket = 0;
  private lastInput = 0;
  private lastChoice = "";
  private lastSentChoice = 0;
  private latest?: CoopSnapshot;
  private displayed?: State;
  private statusMarkup = "";
  private rescueState = "";
  private rescueStarted = 0;
  private panel: HTMLElement;
  private status: HTMLElement;
  private upgrades: HTMLElement;
  private expanded = false;
  private menuOpen = false;
  constructor(
    private actions: {
      snapshot(packet: CoopSnapshot, first: boolean): void;
      leave(): void;
    },
  ) {
    const nav = document.querySelector(".menu-actions")!;
    nav.insertAdjacentHTML(
      "beforeend",
      `<button id="menu-coop" class="menu-button">${groupIcon}<span>${ct("play")}</span></button>`,
    );
    document.getElementById("yard")!.insertAdjacentHTML(
      "beforeend",
      `
      <section id="coop-lobby" class="coop-lobby hidden" role="dialog" aria-modal="true" aria-labelledby="coop-title"></section>
      <aside id="coop-status" class="coop-status hidden"></aside>
      <section id="coop-upgrades" class="coop-upgrades hidden" aria-label="Co-op upgrades"></section>`,
    );
    this.panel = document.getElementById("coop-lobby")!;
    this.status = document.getElementById("coop-status")!;
    this.upgrades = document.getElementById("coop-upgrades")!;
    document
      .getElementById("menu-coop")!
      .addEventListener("click", () => this.open());
    this.panel.addEventListener("click", (e) => {
      const action = (e.target as Element).closest<HTMLElement>("[data-coop]")
        ?.dataset.coop;
      if (action === "back") {
        this.leave();
        this.panel.classList.add("hidden");
        this.lobbyOpen = false;
        document.getElementById("menu-coop")!.focus();
      }
      if (action === "create") this.connect("create");
      if (action === "join")
        this.connect(
          "join",
          this.panel.querySelector<HTMLInputElement>("input")?.value,
        );
      if (action === "start") this.send({ type: "start" });
      if (action === "copy") {
        void navigator.clipboard
          ?.writeText(this.code)
          .then(() => {
            const b = this.panel.querySelector('[data-coop="copy"]');
            if (b) b.textContent = ct("copied");
          })
          .catch(() => {});
      }
      if (action === "resume") this.closeMenu();
      if (action === "leave") {
        this.leave();
        this.actions.leave();
      }
    });
    this.upgrades.addEventListener("click", (e) => {
      const button = (e.target as Element).closest<HTMLElement>("button");
      if (button?.dataset.coop === "expand") {
        this.expanded = !this.expanded;
        this.renderChoices();
      }
      if (button?.dataset.upgrade)
        this.choose(button.dataset.upgrade as UpgradeId);
    });
    this.panel.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
        e.preventDefault();
        this.connect("join", (e.target as HTMLInputElement).value);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (this.active) this.closeMenu();
        else {
          this.leave();
          this.panel.classList.add("hidden");
          this.lobbyOpen = false;
        }
      }
      if (e.key === "Tab") {
        const buttons = [
          ...this.panel.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input",
          ),
        ];
        if (e.shiftKey && document.activeElement === buttons[0]) {
          e.preventDefault();
          buttons.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
          e.preventDefault();
          buttons[0]?.focus();
        }
      }
    });
  }
  private shell(body: string) {
    this.panel.innerHTML = `<div class="coop-sheet"><header><span class="coop-eyebrow">${groupIcon} ONLINE CO-OP · 2P</span><button class="menu-back" data-coop="${this.active ? "resume" : "back"}">${ct("back")}</button></header><h2 id="coop-title">${ct("title")}</h2>${body}</div>`;
    this.panel.classList.remove("hidden");
  }
  open() {
    track("coop_lobby_opened");
    this.lobbyOpen = true;
    this.shell(
      `<p>${ct("intro")}</p><div class="coop-robots"><img src="robots/scrap.png" alt="SCRAP-01"><span>+</span><img src="robots/volt.png" alt="VOLT"></div><div class="coop-connect"><button data-coop="create" class="primary-btn">${ct("create")}</button><div><label for="coop-code">${ct("code")}</label><div class="coop-code-entry"><input id="coop-code" maxlength="6" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="A1B2C3"><button data-coop="join" class="menu-back">${ct("join")}</button></div></div></div><p class="coop-rule">${ct("rule")}</p><p id="coop-message" role="status"></p>`,
    );
    this.panel
      .querySelector<HTMLButtonElement>('[data-coop="create"]')
      ?.focus();
  }
  private connect(type: "create" | "join", code?: string) {
    if (type === "join" && !/^[A-Fa-f0-9]{6}$/.test(code?.trim() ?? "")) {
      this.message(ct("room"));
      return;
    }
    if (this.socket?.readyState === WebSocket.CONNECTING) return;
    this.leave();
    this.lobbyOpen = true;
    track("coop_connection_attempted", { action: type });
    this.message(ct("connecting"));
    const socket = new WebSocket(
      import.meta.env.VITE_COOP_URL ||
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/coop`,
    );
    this.socket = socket;
    let joined = false;
    let failureReported = false;
    const reportFailure = (reason: string) => {
      if (failureReported) return;
      failureReported = true;
      track("coop_connection_failed", { action: type, reason });
    };
    const timeout = window.setTimeout(() => {
      if (this.socket === socket && socket.readyState !== WebSocket.OPEN) {
        reportFailure("timeout");
        socket.close();
        this.message(ct("offline"));
      }
    }, 8000);
    socket.onopen = () => {
      clearTimeout(timeout);
      this.send({ type, code, config: getRunConfig() });
    };
    socket.onmessage = (e) => {
      if (this.socket !== socket) return;
      const m = JSON.parse(e.data);
      if (m.type === "error") {
        reportFailure(m.reason === "room" ? "room_not_found" : "room_busy");
        this.message(ct(m.reason === "room" ? "room" : "busy"));
        return;
      }
      if (m.type === "ended") {
        this.ended(ct(m.reason === "expired" ? "expired" : "closed"));
        return;
      }
      if (m.type === "lobby") {
        if (!joined) {
          joined = true;
          track("coop_lobby_joined", {
            action: type,
            player_role: m.index === 0 ? "host" : "guest",
          });
        }
        this.code = m.code;
        this.index = m.index;
        const ready = m.players.length === 2;
        this.shell(
          `<p>${ct(ready ? "ready" : "waiting")}</p><div class="coop-robots">${m.players.map((id: string) => `<img src="robots/${["scrap", "scout", "volt"].includes(id) ? id : "scrap"}.png" alt="${id}">`).join("<span>+</span>")}${ready ? "" : '<span>+</span><span class="coop-empty">2P</span>'}</div><div class="coop-room-code"><span>${ct("code")}</span><strong>${this.code}</strong><button data-coop="copy" class="menu-back">${ct("copy")}</button></div>${this.index === 0 ? `<button data-coop="start" class="primary-btn" ${ready ? "" : "disabled"}>${ct("start")}</button>` : `<p>${ct("guest")}</p>`}<p class="coop-rule">${ct("rule")}</p>`,
        );
      }
      if (m.type === "snapshot") {
        const packet = m as CoopSnapshot;
        packet.state.encounters.brains = new Map();
        packet.state.discovery.consumed = new Map();
        this.lastPacket = performance.now();
        const first = this.runId !== packet.runId;
        this.runId = packet.runId;
        this.active = true;
        this.lobbyOpen = false;
        this.latest = packet;
        this.partner = packet.partner;
        this.down = packet.down;
        if (first) {
          this.displayed = undefined;
          this.rescueState = "";
          this.menuOpen = false;
          this.lastChoice = "";
          this.expanded = false;
          this.panel.classList.add("hidden");
          document.getElementById("app")!.classList.add("is-coop");
        }
        this.actions.snapshot(packet, first);
        this.renderChoices();
        this.renderStatus();
      }
    };
    socket.onclose = () => {
      clearTimeout(timeout);
      if (this.socket === socket) this.ended(ct("offline"));
    };
    socket.onerror = () => {
      reportFailure("network");
      this.message(ct("offline"));
    };
  }
  private message(text: string) {
    const target = this.panel.querySelector("#coop-message");
    if (target) target.textContent = text;
  }
  private ended(text: string) {
    const wasActive = this.active;
    this.leave();
    if (wasActive) this.actions.leave();
    this.lobbyOpen = true;
    this.shell(
      `<p role="alert">${text}</p><button data-coop="back" class="primary-btn">${ct("back")}</button>`,
    );
    this.panel.querySelector<HTMLButtonElement>('[data-coop="back"]')?.focus();
  }
  send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }
  input(m: Vec, now: number) {
    if (!this.active) return;
    if (now - this.lastPacket > 8000) {
      this.ended(ct("offline"));
      return;
    }
    if (now - this.lastInput < 33) return;
    this.lastInput = now;
    this.send({
      type: "input",
      x: this.menuOpen || this.down || document.hidden ? 0 : m.x,
      z: this.menuOpen || this.down || document.hidden ? 0 : m.z,
    });
  }
  /** Smooth network snapshots only; combat and collisions remain server-authoritative. */
  presentation(state: State, dt: number): State {
    if (!this.active || state.phase === "lost") return state;
    const previous = this.displayed;
    const amount = 1 - Math.exp(-dt * 35);
    const smooth = (a: Vec | undefined, b: Vec): Vec =>
      !a || Math.hypot(a.x - b.x, a.z - b.z) > 4
        ? { ...b }
        : { x: a.x + (b.x - a.x) * amount, z: a.z + (b.z - a.z) * amount };
    const enemies = new Map(previous?.enemies.map((e) => [e.id, e]));
    const shots = new Map(previous?.shots.map((e) => [e.id, e]));
    this.displayed = {
      ...state,
      time:
        state.time +
        Math.min(
          0.08,
          Math.max(0, (performance.now() - this.lastPacket) / 1000),
        ),
      player: smooth(previous?.player, state.player),
      enemies: state.enemies.map((e) => ({
        ...e,
        ...smooth(enemies.get(e.id), e),
      })),
      shots: state.shots.map((e) => ({ ...e, ...smooth(shots.get(e.id), e) })),
    };
    return this.displayed;
  }
  stopInput() {
    this.send({ type: "input", x: 0, z: 0 });
  }
  choose(id: UpgradeId) {
    const state = this.latest?.state;
    if (
      !state?.choices.includes(id) ||
      this.down ||
      performance.now() - this.lastSentChoice < 250
    )
      return;
    this.lastSentChoice = performance.now();
    this.send({ type: "choose", id, level: state.level });
    document.getElementById("yard")!.focus({ preventScroll: true });
  }
  chooseKey(index: number) {
    const id = this.latest?.state.choices[index];
    if (id) this.choose(id);
  }
  private renderChoices() {
    const s = this.latest?.state;
    const visible =
      !!s?.choices.length && s.phase !== "lost" && !this.down && !this.menuOpen;
    this.upgrades.classList.toggle("hidden", !visible);
    if (!visible || !s) return;
    const key = `${s.level}:${s.choices.join(",")}:${this.expanded}`;
    if (this.lastChoice === key) return;
    this.lastChoice = key;
    this.upgrades.innerHTML = `<button class="coop-upgrade-toggle" data-coop="expand" aria-expanded="${this.expanded}"><span>+ ${ct("upgrade")}</span><span>LV ${s.level} ${this.expanded ? "−" : "+"}</span></button>${this.expanded ? `<div class="coop-choice-list">${upgradeChoicesMarkup(s)}</div><p>${ct("live")}</p>` : ""}`;
  }
  private renderStatus() {
    const p = this.partner,
      s = this.latest?.state;
    if (!p || !s) return;
    this.status.classList.toggle("hidden", s.phase === "lost");
    const distance = Math.round(
      Math.hypot(p.player.x - s.player.x, p.player.z - s.player.z),
    );
    const rescue = this.down ? "down" : p.hp <= 0 ? "revive" : "";
    if (rescue !== this.rescueState) {
      this.rescueState = rescue;
      this.rescueStarted = performance.now();
    }
    const status =
      rescue && performance.now() - this.rescueStarted < 2000 ? ct(rescue) : "";
    const progress = Math.round(
      (Math.max(p.revive, this.latest?.revive ?? 0) / 3) * 100,
    );
    // Text is intentionally short: the battle remains the focus.
    const markup = `<svg class="coop-direction" viewBox="0 0 20 20" aria-hidden="true" style="transform:rotate(${(Math.atan2(p.player.z - s.player.z, p.player.x - s.player.x) * 180) / Math.PI + 90}deg)"><path d="m10 2 6 15-6-3-6 3Z" fill="currentColor"/></svg><strong>2P</strong><span>${Math.ceil(p.hp)} HP · ${distance} m</span>${status || progress > 0 ? `<span class="coop-revive">${status}${progress > 0 ? ` ${progress}%` : ""}</span>` : ""}`;
    if (markup !== this.statusMarkup) {
      this.statusMarkup = markup;
      this.status.innerHTML = markup;
    }
  }
  openMenu() {
    if (!this.active) return;
    this.menuOpen = true;
    this.stopInput();
    this.renderChoices();
    this.shell(
      `<p>${ct("running")}</p><button class="primary-btn" data-coop="resume">${ct("resume")}</button><button class="menu-back" data-coop="leave">${ct("leave")}</button>`,
    );
    this.panel
      .querySelector<HTMLButtonElement>('[data-coop="resume"]')
      ?.focus();
  }
  closeMenu() {
    this.menuOpen = false;
    this.panel.classList.add("hidden");
    this.renderChoices();
    document.getElementById("yard")!.focus({ preventScroll: true });
  }
  again() {
    if (this.index === 0) this.send({ type: "start" });
  }
  leave() {
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "leave" }));
      socket.close();
    }
    this.active = false;
    this.displayed = undefined;
    this.partner = null;
    this.down = false;
    this.runId = "";
    this.latest = undefined;
    this.lastChoice = "";
    this.menuOpen = false;
    this.panel.classList.add("hidden");
    this.upgrades.classList.add("hidden");
    this.status.classList.add("hidden");
    document.getElementById("app")!.classList.remove("is-coop");
  }
  refresh() {
    document.querySelector("#menu-coop span")!.textContent = ct("play");
    this.lastChoice = "";
  }
}
