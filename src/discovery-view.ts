import * as THREE from "three";
import {
  DISCOVERY_LIMITS,
  discoveryRadius,
  type DiscoveryGameState,
  type DiscoveryKind,
} from "./discovery";
export type DiscoveryModels = Record<DiscoveryKind, THREE.Group>;

/** Clones share loaded GLB geometry/materials; streaming only changes transforms. */
export class DiscoveryView {
  private root = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private slots: {
    root: THREE.Group;
    models: DiscoveryModels;
    lid?: THREE.Object3D;
    loot?: THREE.Object3D;
    lights: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[];
    ring: THREE.Mesh;
    area: THREE.Mesh;
    ticks: THREE.Mesh[];
    sparks: THREE.Mesh[];
  }[] = [];
  private spent = new THREE.MeshStandardMaterial({
    color: 0x526766,
    roughness: 0.8,
  });
  constructor(scene: THREE.Scene, templates: DiscoveryModels) {
    scene.add(this.root);
    const gold = new THREE.MeshBasicMaterial({
      color: 0xf4c558,
      depthWrite: false,
    });
    const progressMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd34e,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const faded = new THREE.MeshBasicMaterial({
      color: 0xb4d2ca,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const areaMaterial = new THREE.MeshBasicMaterial({
      color: 0x3f5961,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(gold, progressMaterial, faded, areaMaterial, this.spent);
    const ring = new THREE.RingGeometry(0.94, 1, 48);
    const disc = new THREE.CircleGeometry(0.94, 48);
    const tick = new THREE.RingGeometry(
      0.80,
      0.91,
      3,
      1,
      0,
      ((Math.PI * 2) / 24) * 0.8,
    );
    const spark = new THREE.IcosahedronGeometry(0.07, 0);
    this.geometries.push(ring, disc, tick, spark);
    for (let i = 0; i < DISCOVERY_LIMITS.points; i++) {
      const root = new THREE.Group();
      this.root.add(root);
      const models = {} as DiscoveryModels;
      const lights: (typeof this.slots)[number]["lights"] = [];
      for (const kind of ["repair", "chest", "salvage"] as const) {
        const model = templates[kind].clone(true);
        models[kind] = model;
        root.add(model);
        model.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          o.castShadow = true;
          o.receiveShadow = true;
          const material = Array.isArray(o.material)
            ? o.material[0]
            : o.material;
          if (
            kind !== "chest" &&
            ["Electric ceramic", "Amber beacon"].includes(material.name)
          )
            lights.push({ mesh: o, material: o.material });
        });
      }
      const area = new THREE.Mesh(disc, areaMaterial);
      area.rotation.x = -Math.PI / 2;
      area.position.y = 0.025;
      root.add(area);
      const outline = new THREE.Mesh(ring, faded);
      outline.rotation.x = -Math.PI / 2;
      outline.position.y = 0.04;
      outline.renderOrder = 1;
      root.add(outline);
      const ticks: THREE.Mesh[] = [];
      for (let n = 0; n < 24; n++) {
        const t = new THREE.Mesh(tick, progressMaterial);
        t.rotation.set(-Math.PI / 2, 0, (n * Math.PI * 2) / 24);
        t.position.y = 0.065;
        // Draw after the translucent floor so it cannot wash out progress.
        // Keep depth testing enabled so the marker stays behind solid objects.
        t.renderOrder = 2;
        root.add(t);
        ticks.push(t);
      }
      const sparks: THREE.Mesh[] = [];
      for (let n = 0; n < 6; n++) {
        const m = new THREE.Mesh(spark, gold);
        m.visible = false;
        root.add(m);
        sparks.push(m);
      }
      root.visible = false;
      this.slots.push({
        root,
        models,
        lights,
        lid: models.chest.getObjectByName("Chest_Lid"),
        loot: models.chest.getObjectByName("Chest_Loot"),
        ring: outline,
        area,
        ticks,
        sparks,
      });
    }
  }
  update(s: DiscoveryGameState, reduced = false) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i],
        p = s.discovery.points[i];
      slot.root.visible = Boolean(p) && s.phase !== "ready";
      if (!p) continue;
      slot.root.position.set(p.x, 0, p.z);
      const radius = discoveryRadius(p.kind);
      slot.ring.scale.setScalar(radius);
      slot.ring.visible = !p.completed;
      slot.area.scale.setScalar(radius);
      slot.area.visible = !p.completed;
      for (const kind of ["repair", "chest", "salvage"] as const)
        slot.models[kind].visible = kind === p.kind;
      const age =
        p.completedAt === undefined
          ? Infinity
          : Math.max(0, s.time - p.completedAt);
      const opening = p.completed ? (reduced ? 1 : Math.min(1, age / 0.55)) : 0;
      if (slot.lid) slot.lid.rotation.x = -1.8 * (1 - (1 - opening) ** 3);
      if (slot.loot) slot.loot.visible = !p.completed || age < 0.28;
      for (const light of slot.lights)
        light.mesh.material = p.completed ? this.spent : light.material;
      const fraction = p.progress / (p.kind === "salvage" ? 8 : 1.2);
      for (let n = 0; n < slot.ticks.length; n++) {
        slot.ticks[n].visible = !p.completed && n < Math.floor(fraction * 24);
        slot.ticks[n].scale.setScalar(radius);
      }
      for (let n = 0; n < slot.sparks.length; n++) {
        const spark = slot.sparks[n];
        spark.visible = p.completed && !reduced && age < 0.85;
        if (!spark.visible) continue;
        const a = (n * Math.PI) / 3,
          spread = 0.15 + age * 0.85;
        spark.position.set(
          Math.cos(a) * spread,
          0.8 + age * 1.5,
          Math.sin(a) * spread,
        );
        spark.rotation.set(age * 3, n, age * 2);
        spark.scale.setScalar(Math.max(0.05, 1 - age / 0.85));
      }
    }
  }
  dispose() {
    this.root.removeFromParent();
    // GLB resources are shared with the asset cache, so only dispose our overlays.
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
