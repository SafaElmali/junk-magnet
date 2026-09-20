import * as THREE from "three";
import type { DroneState, DroneMode } from "./drone";

const COLORS = { collector: 0x68d6ea, repair: 0x82d294, guard: 0xf4a566 };
/** Shared GLB geometry, per-companion materials; no frame-time GPU allocations. */
export class DroneView {
  private group = new THREE.Group();
  private body = new THREE.Group();
  private fans: THREE.Object3D[] = [];
  private tools = new Map<DroneMode, THREE.Object3D>();
  private materials: THREE.Material[] = [];
  private status: THREE.MeshStandardMaterial[] = [];
  private glow = new THREE.MeshBasicMaterial({ color: COLORS.collector, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
  private beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), this.glow);
  private up = new THREE.Vector3(0, 1, 0);
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private lastTime = -1;
  private yaw = 0;
  private lastX = 0;
  private lastZ = 0;
  constructor(private scene: THREE.Scene) {
    this.group.add(this.body);
    scene.add(this.group, this.beam);
    this.clear();
  }
  setModel(source: THREE.Object3D) {
    this.body.clear();
    this.materials.forEach(m => m.dispose());
    this.materials = []; this.status = []; this.tools.clear();
    const model = source.clone(true);
    const copies = new Map<THREE.Material, THREE.Material>();
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      const clone = (original: THREE.Material) => {
        let copy = copies.get(original);
        if (!copy) {
          copy = original.clone(); copies.set(original, copy); this.materials.push(copy);
          if (copy.name === "Drone_Status" && copy instanceof THREE.MeshStandardMaterial) this.status.push(copy);
        }
        return copy;
      };
      node.material = Array.isArray(node.material) ? node.material.map(clone) : clone(node.material);
    });
    this.body.add(model);
    this.fans = ["Fan_L", "Fan_R"].flatMap(name => model.getObjectByName(name) ?? []);
    for (const [mode, name] of [["collector", "Tool_Collector"], ["repair", "Tool_Repair"], ["guard", "Tool_Guard"]] as const) {
      const tool = model.getObjectByName(name);
      if (tool) this.tools.set(mode, tool);
    }
  }
  update(s: { drone: DroneState; time: number; phase?: string; hp?: number }, reduced = false) {
    if (!s.drone || s.phase === "ready" || s.phase === "lost" || (s.hp !== undefined && s.hp <= 0)) { this.clear(); return; }
    const d = s.drone;
    const fresh = this.lastTime < 0 || s.time < this.lastTime;
    const dt = fresh ? 0 : Math.min(0.1, Math.max(0, s.time - this.lastTime));
    const dx = fresh ? 0 : d.x - this.lastX, dz = fresh ? 0 : d.z - this.lastZ;
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    const aiming = d.pulse > 0;
    const targetYaw = aiming ? Math.atan2(d.targetX - d.x, d.targetZ - d.z) : speed > 0.15 ? Math.atan2(dx, dz) : this.yaw;
    const turn = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw));
    this.yaw += turn * (fresh || reduced ? 1 : 1 - Math.exp(-dt * 9));
    this.group.visible = true;
    this.group.position.set(d.x, 1.65 + (reduced ? 0 : Math.sin(s.time * 3) * 0.055), d.z);
    this.body.rotation.set(reduced ? 0 : Math.min(speed * 0.025, 0.16), this.yaw, reduced ? 0 : -Math.max(-0.15, Math.min(0.15, turn * 0.10)), "YXZ");
    for (let i = 0; i < this.fans.length; i++) this.fans[i].rotation.y = reduced ? 0 : s.time * (i ? -24 : 24);
    for (const [mode, tool] of this.tools) {
      tool.visible = mode === d.mode;
      tool.position.z = mode === "guard" && aiming && !reduced ? -Math.sin(Math.min(1, d.pulse / .3) * Math.PI) * .06 : 0;
    }
    for (const material of this.status) {
      material.color.setHex(COLORS[d.mode]); material.emissive.copy(material.color);
      material.emissiveIntensity = aiming ? 1.8 : 0.7;
    }
    this.glow.color.setHex(COLORS[d.mode]);
    this.glow.opacity = d.mode === "guard" ? 0.8 : 0.42;
    this.beam.visible = aiming;
    if (aiming) {
      this.start.copy(this.group.position); this.start.y -= 0.3;
      this.end.set(d.targetX, d.mode === "collector" ? 0.15 : 0.65, d.targetZ);
      this.direction.subVectors(this.end, this.start);
      const length = this.direction.length();
      this.beam.position.copy(this.start).lerp(this.end, 0.5);
      this.beam.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
      this.beam.scale.set(1, length, 1);
    }
    this.lastTime = s.time; this.lastX = d.x; this.lastZ = d.z;
  }
  clear() { this.group.visible = false; this.beam.visible = false; this.lastTime = -1; }
  dispose() {
    this.scene.remove(this.group, this.beam);
    this.beam.geometry.dispose(); this.glow.dispose();
    this.materials.forEach(m => m.dispose());
    // GLB geometry belongs to the scene's shared asset cache.
  }
}
