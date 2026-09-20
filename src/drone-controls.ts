import { getLanguage, t, type Language } from "./i18n";
import { DRONE_MODES, DRONE_MAX_RANK, DRONE_SPECIAL_DESCRIPTIONS, droneRank, droneStats, type DroneMode, type DroneGameState } from "./drone";
import "./drone.css";

type Copy = { helper: string; change: string; modes: Record<DroneMode, [string, string]> };
export const DRONE_COPY: Record<Language, Copy> = {
  en: { helper: "HELPER DRONE", change: "Change drone role", modes: {
    collector: ["Collector", "Retrieves nearby scrap and energy."],
    repair: ["Repair", "Repairs 3 health every 5 seconds."],
    guard: ["Guard", "Hits a nearby enemy for 3 damage every 2 seconds."],
  } },
  tr: { helper: "YARDIMCI DRONE", change: "Drone görevini değiştir", modes: {
    collector: ["Toplayıcı", "Yakındaki hurda ve enerjiyi getirir."],
    repair: ["Onarım", "Her 5 saniyede 3 can yeniler."],
    guard: ["Koruma", "Her 2 saniyede yakındaki düşmana 3 hasar verir."],
  } },
  de: { helper: "HELFERDROHNE", change: "Drohnenrolle wechseln", modes: {
    collector: ["Sammler", "Holt Schrott und Energie aus der Nähe."],
    repair: ["Reparatur", "Stellt alle 5 Sekunden 3 Lebenspunkte wieder her."],
    guard: ["Wache", "Fügt einem nahen Gegner alle 2 Sekunden 3 Schaden zu."],
  } },
  fr: { helper: "DRONE AUXILIAIRE", change: "Changer le rôle du drone", modes: {
    collector: ["Collecteur", "Rapporte la ferraille et l’énergie proches."],
    repair: ["Réparation", "Restaure 3 points de vie toutes les 5 secondes."],
    guard: ["Garde", "Inflige 3 dégâts à un ennemi proche toutes les 2 secondes."],
  } },
  es: { helper: "DRON AUXILIAR", change: "Cambiar el rol del dron", modes: {
    collector: ["Recolector", "Recoge chatarra y energía cercanas."],
    repair: ["Reparación", "Restaura 3 de salud cada 5 segundos."],
    guard: ["Guardián", "Inflige 3 de daño a un enemigo cercano cada 2 segundos."],
  } },
  pt: { helper: "DRONE AUXILIAR", change: "Mudar função do drone", modes: {
    collector: ["Coletor", "Traz sucata e energia próximas."],
    repair: ["Reparo", "Restaura 3 de vida a cada 5 segundos."],
    guard: ["Guarda", "Causa 3 de dano a um inimigo próximo a cada 2 segundos."],
  } },
};
const icons: Record<DroneMode, string> = {
  collector: '<path d="M7 5v7a5 5 0 0 0 10 0V5M5 5h4M15 5h4M7 9h2M15 9h2"/>',
  repair: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
  guard: '<path d="m12 3 8 3v6c0 4-5 7-8 9-3-2-8-5-8-9V6zM8 12l3 3 5-6"/>',
};
export class DroneControls {
  private button = document.createElement("button");
  private mode: DroneMode = "collector";
  private rendered = "";
  private choose = () => this.onSelect(DRONE_MODES[(DRONE_MODES.indexOf(this.mode) + 1) % DRONE_MODES.length]);
  private touchChoose = (event: TouchEvent) => {
    // A second finger may not generate a click while the joystick is held.
    // Cancel the compatibility click so one touch cannot cycle twice.
    event.preventDefault();
    if (!this.button.disabled) this.choose();
  };
  constructor(private root: HTMLElement, private onSelect: (mode: DroneMode) => void) {
    this.button.type = "button";
    this.button.className = "drone-control";
    this.button.addEventListener("click", this.choose);
    this.button.addEventListener("touchstart", this.touchChoose, { passive: false });
    root.append(this.button);
  }
  update(s: DroneGameState) {
    this.root.hidden = s.phase !== "playing" || s.hp <= 0;
    this.mode = s.drone.mode;
    this.button.disabled = s.drone.modeCooldown > 0;
    const language = getLanguage(), copy = DRONE_COPY[language];
    const [name] = copy.modes[this.mode];
    const rank = droneRank(s);
    const key = `${language}:${this.mode}:${rank}:${s.drone.emergencyUsed}`;
    if (this.rendered === key) return;
    this.rendered = key;
    const benefit = (rank: number) => {
      const stats = droneStats(rank);
      const number = (value: number) => value.toLocaleString(language, { maximumFractionDigits: 2 });
      return this.mode === "collector" ? t("{range} m · faster retrieval", { range: stats.range }) :
        this.mode === "repair" ? t("{healing} health / {seconds}s", { healing: stats.healing, seconds: number(stats.repairInterval) }) :
          t("{damage} damage / {seconds}s", { damage: stats.damage, seconds: number(stats.guardInterval) });
    };
    const status = this.mode === "repair" && rank === DRONE_MAX_RANK
      ? t(s.drone.emergencyUsed ? "Emergency heal used" : "Emergency heal ready") : "";
    const detail = t(DRONE_SPECIAL_DESCRIPTIONS[this.mode]);
    const description = `${benefit(rank)}. ${rank === DRONE_MAX_RANK ? detail : ""}`;
    this.button.dataset.mode = this.mode;
    this.button.dataset.rank = String(rank);
    const statusDescription = status ? `${status}. ` : "";
    this.button.title = `${description} ${statusDescription}${copy.change} (Q)`;
    this.button.setAttribute("aria-label", `${t("{name}, rank {rank}", { name: `${copy.helper}: ${name}`, rank })}. ${description} ${statusDescription}${copy.change}`);
    const rankBar = Array.from({ length: DRONE_MAX_RANK }, (_, index) => `<i${index < rank ? ' class="is-filled"' : ""}></i>`).join("");
    this.button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[this.mode]}</svg><span class="drone-control-copy"><small>${copy.helper}</small><strong>${name}</strong><span class="drone-rank" aria-hidden="true">${rankBar}</span>${status ? `<span class="drone-status">${status}</span>` : ""}</span><span class="drone-cycle" aria-hidden="true"><kbd>Q</kbd><span>↻</span></span>`;
  }
  dispose() {
    this.button.removeEventListener("click", this.choose);
    this.button.removeEventListener("touchstart", this.touchChoose);
    this.button.remove();
  }
}
