import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { State } from "./simulation";
import { ENTITY_LIMITS } from "./simulation";
import { areaScale, ELITE } from "./arsenal";
import { EncounterView } from "./encounters-view";
import { DiscoveryView, type DiscoveryModels } from "./discovery-view";
type EnemyKits = Record<"charger" | "spitter" | "warden", THREE.Group>;
/** Reused silhouettes give special enemies a readable shape, independent of color. */
export class ExpansionView {
  encounters: EncounterView;
  discovery: DiscoveryView;
  private accents = new Map<keyof EnemyKits, THREE.InstancedMesh[]>();
  private cyclone: THREE.Group;
  private transform = new THREE.Object3D();

  constructor(
    scene: THREE.Scene,
    discoveryModels: DiscoveryModels,
    kits: EnemyKits,
  ) {
    this.encounters = new EncounterView(scene);
    this.discovery = new DiscoveryView(scene, discoveryModels);
    // Merge authored parts by material once; enemy counts never add draw calls.
    for (const kind of ["charger", "spitter", "warden"] as const) {
      const source = kits[kind];
      source.updateMatrixWorld(true);
      const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
      source.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
          return;
        const geometry = object.geometry.index
          ? object.geometry.toNonIndexed()
          : object.geometry.clone();
        geometry.deleteAttribute("tangent");
        geometry.deleteAttribute("uv1");
        geometry.applyMatrix4(object.matrixWorld);
        const group = parts.get(object.material) ?? [];
        group.push(geometry);
        parts.set(object.material, group);
      });
      const batches = [...parts].map(([material, geometries]) => {
        const geometry = mergeGeometries(geometries, false)!;
        geometries.forEach((part) => part.dispose());
        const batch = new THREE.InstancedMesh(
          geometry,
          material,
          ENTITY_LIMITS.enemies,
        );
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        batch.count = 0;
        batch.castShadow = true;
        batch.receiveShadow = true;
        scene.add(batch);
        return batch;
      });
      this.accents.set(kind, batches);
    }
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
    const reach = 3.3 * areaScale(s);
    this.cyclone.children.forEach((m, i) => {
      const a = s.time * 3.5 + (i * Math.PI) / 3;
      m.position.set(
        Math.cos(a) * reach,
        Math.sin(a * 2) * 0.15,
        Math.sin(a) * reach,
      );
      m.rotation.y = -a;
    });
    const counts = { charger: 0, spitter: 0, warden: 0 };
    const tr = this.transform;
    for (const e of s.enemies) {
      if (e.type !== "charger" && e.type !== "spitter" && e.type !== "warden")
        continue;
      // Equipment follows the body's bounce, facing, proportions and hit squash.
      tr.position.set(
        e.x,
        Math.abs(Math.sin(s.time * 8 + e.seed)) * 0.065,
        e.z,
      );
      tr.rotation.set(
        0,
        Math.atan2(s.player.x - e.x, s.player.z - e.z),
        Math.sin(s.time * 8 + e.seed) * 0.06,
      );
      const k =
        (e.hit > 0 ? 1 + Math.sin(e.hit * 20) * 0.08 : 1) *
        (e.elite ? ELITE.scale : 1);
      if (e.type === "charger") tr.scale.set(k * 0.9, k * 1.2, k * 1.3);
      else if (e.type === "warden") tr.scale.set(k * 1.4, k * 1.2, k * 1.4);
      else tr.scale.setScalar(k * 1.12);
      tr.updateMatrix();
      for (const batch of this.accents.get(e.type)!)
        batch.setMatrixAt(counts[e.type], tr.matrix);
      counts[e.type]++;
    }
    for (const [kind, batches] of this.accents)
      for (const batch of batches) {
        batch.count = counts[kind];
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingSphere();
      }
  }
}
