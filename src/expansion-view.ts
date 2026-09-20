import * as THREE from "three";
import type { State } from "./simulation";
import { ENTITY_LIMITS } from "./simulation";
import { EncounterView } from "./encounters-view";
import { DiscoveryView, type DiscoveryModels } from "./discovery-view";
/** Reused silhouettes give special enemies a readable shape, independent of color. */
export class ExpansionView {
  encounters: EncounterView;
  discovery: DiscoveryView;
  private accents: THREE.InstancedMesh;
  private cyclone: THREE.Group;
  private transform = new THREE.Object3D();
  private color = new THREE.Color();
  constructor(scene: THREE.Scene, discoveryModels: DiscoveryModels) {
    this.encounters = new EncounterView(scene);
    this.discovery = new DiscoveryView(scene, discoveryModels);
    this.accents = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.4,
        roughness: 0.6,
      }),
      ENTITY_LIMITS.enemies * 3,
    );
    this.accents.frustumCulled = false;
    this.accents.count = 0;
    scene.add(this.accents);
    this.cyclone = new THREE.Group();
    scene.add(this.cyclone);
    const blade = new THREE.ConeGeometry(0.32, 0.9, 3);
    const gold = new THREE.MeshStandardMaterial({
      color: 0xf3ce71,
      emissive: 0x5e3810,
      metalness: 0.65,
      roughness: 0.3,
    });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(blade, gold);
      m.rotation.z = Math.PI / 2;
      this.cyclone.add(m);
    }
  }
  update(s: State, reduced = false) {
    this.encounters.update(s);
    this.discovery.update(s, reduced);
    this.cyclone.visible = s.evolutions.vortex;
    this.cyclone.position.set(s.player.x, 0.6, s.player.z);
    this.cyclone.children.forEach((m, i) => {
      const a = s.time * 3.5 + (i * Math.PI) / 3;
      m.position.set(
        Math.cos(a) * 3.3,
        Math.sin(a * 2) * 0.15,
        Math.sin(a) * 3.3,
      );
      m.rotation.y = -a;
    });
    let count = 0;
    const tr = this.transform;
    for (const e of s.enemies) {
      if (e.type === "can" || e.type === "runner" || e.type === "brute")
        continue;
      const boss = e.type === "boss" || e.type === "miniboss",
        scale = e.type === "boss" ? 2.9 : e.type === "miniboss" ? 2.1 : 1;
      const a = Math.atan2(s.player.x - e.x, s.player.z - e.z);
      const part = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: number,
      ) => {
        tr.position.set(
          e.x + (x * Math.cos(a) + z * Math.sin(a)) * scale,
          y * scale,
          e.z + (-x * Math.sin(a) + z * Math.cos(a)) * scale,
        );
        tr.rotation.set(0, a, 0);
        tr.scale.set(w * scale, h * scale, d * scale);
        tr.updateMatrix();
        this.accents.setMatrixAt(count, tr.matrix);
        this.accents.setColorAt(count++, this.color.setHex(color));
      };
      if (boss) {
        part(-0.43, 0.95, 0.05, 0.22, 0.55, 0.5, 0xe8ba59);
        part(0.43, 0.95, 0.05, 0.22, 0.55, 0.5, 0xe8ba59);
        part(0, 1.3, 0, 0.5, 0.2, 0.25, 0xf1d394);
      } else if (e.type === "charger") {
        part(-0.28, 0.75, 0.45, 0.17, 0.17, 0.6, 0xf1cf9e);
        part(0.28, 0.75, 0.45, 0.17, 0.17, 0.6, 0xf1cf9e);
      } else if (e.type === "spitter") {
        part(0, 0.78, 0.55, 0.36, 0.32, 0.8, 0x65d4bf);
      } else {
        part(-0.48, 0.5, 0, 0.2, 1.2, 0.6, 0x5a798e);
        part(0.48, 0.5, 0, 0.2, 1.2, 0.6, 0x5a798e);
      }
    }
    this.accents.count = count;
    this.accents.instanceMatrix.needsUpdate = true;
    if (this.accents.instanceColor)
      this.accents.instanceColor.needsUpdate = true;
  }
}
