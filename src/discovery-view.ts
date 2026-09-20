import * as THREE from "three";
import {
  DISCOVERY_LIMITS,
  discoveryRadius,
  type DiscoveryGameState,
  type DiscoveryKind,
} from "./discovery";

/** Fixed reusable meshes. Streaming never allocates GPU geometry or textures. */
export class DiscoveryView {
  private root = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private slots: {
    root: THREE.Group;
    models: Record<DiscoveryKind, THREE.Group>;
    ring: THREE.Mesh;
    ticks: THREE.Mesh[];
  }[] = [];
  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    const material = (color: number, emissive = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.15,
        emissive,
        emissiveIntensity: 0.35,
      });
      this.materials.push(m);
      return m;
    };
    const teal = material(0x459b9c),
      ink = material(0x173342),
      gold = material(0xf4c558, 0x6b4b05),
      cream = material(0xfff4d8),
      red = material(0xcc654e);
    const faded = new THREE.MeshBasicMaterial({
      color: 0x459b9c,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(faded);
    const box = new THREE.BoxGeometry(1, 1, 1),
      cylinder = new THREE.CylinderGeometry(1, 1, 1, 12),
      ring = new THREE.RingGeometry(0.97, 1, 48),
      tick = new THREE.RingGeometry(
        0.89,
        0.96,
        3,
        1,
        0,
        ((Math.PI * 2) / 24) * 0.8,
      );
    this.geometries.push(box, cylinder, ring, tick);
    const mesh = (
      parent: THREE.Group,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      scale: number[],
      pos: number[],
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(scale[0], scale[1], scale[2]);
      m.position.set(pos[0], pos[1], pos[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    for (let i = 0; i < DISCOVERY_LIMITS.points; i++) {
      const root = new THREE.Group();
      this.root.add(root);
      const repair = new THREE.Group(),
        chest = new THREE.Group(),
        salvage = new THREE.Group();
      root.add(repair, chest, salvage);
      // Repair dock: teal station, cream face and a physical red cross.
      mesh(repair, box, ink, [1.3, 0.2, 1.1], [0, 0.15, 0]);
      mesh(repair, box, teal, [0.95, 1.05, 0.65], [0, 0.7, 0]);
      mesh(repair, box, cream, [0.75, 0.7, 0.08], [0, 0.82, 0.36]);
      mesh(repair, box, red, [0.15, 0.46, 0.1], [0, 0.82, 0.42]);
      mesh(repair, box, red, [0.46, 0.15, 0.1], [0, 0.82, 0.42]);
      mesh(repair, cylinder, gold, [0.1, 0.12, 0.1], [0, 1.3, 0]);
      // Supply chest: brass banding and a bright central latch.
      mesh(chest, box, ink, [1.35, 0.65, 0.95], [0, 0.4, 0]);
      mesh(chest, box, teal, [1.4, 0.2, 1], [0, 0.83, 0]);
      for (const x of [-0.44, 0.44])
        mesh(chest, box, gold, [0.12, 0.9, 1.03], [x, 0.52, 0]);
      mesh(chest, box, gold, [0.25, 0.25, 0.12], [0, 0.66, 0.53]);
      // Salvage beacon: scrap collection platform with an amber signal.
      mesh(salvage, cylinder, ink, [1.1, 0.15, 1.1], [0, 0.13, 0]);
      mesh(salvage, box, teal, [1.05, 0.55, 0.85], [0, 0.47, 0]);
      mesh(salvage, box, cream, [0.7, 0.12, 0.5], [0, 0.82, 0]);
      mesh(salvage, cylinder, ink, [0.07, 1.4, 0.07], [0.7, 0.85, 0]);
      mesh(salvage, cylinder, gold, [0.2, 0.28, 0.2], [0.7, 1.67, 0]);
      const outline = new THREE.Mesh(ring, faded);
      outline.rotation.x = -Math.PI / 2;
      outline.position.y = 0.05;
      root.add(outline);
      const ticks: THREE.Mesh[] = [];
      for (let n = 0; n < 24; n++) {
        const t = new THREE.Mesh(tick, gold);
        t.rotation.set(-Math.PI / 2, 0, (n * Math.PI * 2) / 24);
        t.position.y = 0.065;
        root.add(t);
        ticks.push(t);
      }
      root.visible = false;
      this.slots.push({
        root,
        models: { repair, chest, salvage },
        ring: outline,
        ticks,
      });
    }
  }
  update(s: DiscoveryGameState) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i],
        p = s.discovery.points[i];
      slot.root.visible = Boolean(p) && s.phase !== "ready";
      if (!p) continue;
      slot.root.position.set(p.x, 0, p.z);
      const radius = discoveryRadius(p.kind);
      slot.ring.scale.setScalar(radius);
      slot.ring.visible = !p.completed;
      for (const kind of ["repair", "chest", "salvage"] as const) {
        slot.models[kind].visible = kind === p.kind;
        slot.models[kind].scale.y = p.completed ? 0.6 : 1;
        slot.models[kind].position.y = p.completed ? -0.15 : 0;
      }
      const fraction = p.progress / (p.kind === "salvage" ? 8 : 1.2);
      for (let n = 0; n < slot.ticks.length; n++) {
        slot.ticks[n].visible = !p.completed && n < Math.floor(fraction * 24);
        slot.ticks[n].scale.setScalar(radius);
      }
    }
  }
  dispose() {
    this.root.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
