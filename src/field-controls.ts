import type { State } from "./simulation";
import { DroneControls } from "./drone-controls";
import type { DroneMode } from "./drone";
import "./field-controls.css";

export class FieldControls {
  private panel: HTMLElement;
  private drone: DroneControls;
  constructor(root: HTMLElement, drone: (mode: DroneMode) => void) {
    root.insertAdjacentHTML("beforeend", `<div class="field-controls hidden"><div id="drone-controls"></div></div>`);
    this.panel = root.querySelector(".field-controls")!;
    this.drone = new DroneControls(root.querySelector("#drone-controls")!, drone);
  }
  update(s: State, visible: boolean) {
    this.panel.classList.toggle("hidden", !visible);
    if (visible) this.drone.update(s);
  }
}
