import * as THREE from "three";
import type { State } from "./simulation";
import { ENCOUNTER_LIMITS } from "./encounters";

/** Fixed geometry pools: advancing or pausing a run never allocates render objects. */
export class EncounterView {
  private root = new THREE.Group();
  private warnings: {
    group: THREE.Group;
    ring: THREE.Mesh;
    fill: THREE.Mesh;
    lane: THREE.Mesh;
    edge: THREE.Mesh;
  }[] = [];
  private zones: { group: THREE.Group; ring: THREE.Mesh; fill: THREE.Mesh }[] =
    [];
  private bolts: THREE.InstancedMesh;
  private cores: THREE.InstancedMesh;
  private transform = new THREE.Object3D();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  constructor(scene: THREE.Scene) {
    const ring = new THREE.RingGeometry(0.91, 1, 48);
    const circle = new THREE.CircleGeometry(1, 40);
    const plane = new THREE.PlaneGeometry(1, 1);
    const sphere = new THREE.IcosahedronGeometry(1, 1);
    this.geometries.push(ring, circle, plane, sphere);
    const material = (color: number, opacity: number) => {
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(m);
      return m;
    };
    const amber = material(0x9e462c, 1),
      amberFill = material(0xffc451, 0.32);
    const coral = material(0xff6246, 0.95),
      coralFill = material(0xd64325, 0.26);
    const dark = material(0x572b26, 1),
      hot = material(0xffedaf, 1);
    const ground = (
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      y: number,
    ) => {
      const m = new THREE.Mesh(geometry, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.renderOrder = 3;
      return m;
    };
    for (let i = 0; i < ENCOUNTER_LIMITS.warnings; i++) {
      const group = new THREE.Group();
      const outline = ground(ring, amber, 0.055),
        fill = ground(circle, amberFill, 0.05);
      const lane = ground(plane, amberFill, 0.055),
        edge = ground(plane, amber, 0.06);
      group.add(outline, fill, lane, edge);
      group.visible = false;
      this.root.add(group);
      this.warnings.push({ group, ring: outline, fill, lane, edge });
    }
    for (let i = 0; i < ENCOUNTER_LIMITS.zones; i++) {
      const group = new THREE.Group(),
        outline = ground(ring, coral, 0.065),
        fill = ground(circle, coralFill, 0.06);
      group.add(outline, fill);
      group.visible = false;
      this.root.add(group);
      this.zones.push({ group, ring: outline, fill });
    }
    this.bolts = new THREE.InstancedMesh(
      sphere,
      dark,
      ENCOUNTER_LIMITS.projectiles,
    );
    this.cores = new THREE.InstancedMesh(
      sphere,
      hot,
      ENCOUNTER_LIMITS.projectiles,
    );
    this.bolts.frustumCulled = false;
    this.cores.frustumCulled = false;
    this.bolts.count = 0;
    this.cores.count = 0;
    this.root.add(this.bolts, this.cores);
    scene.add(this.root);
  }
  update(s: State) {
    this.root.visible = s.phase !== "ready";
    const c = s.encounters;
    this.warnings.forEach((item, i) => {
      const w = c.warnings[i];
      item.group.visible = !!w;
      if (!w) return;
      item.group.position.set(w.x, 0, w.z);
      const area = w.kind === "zone",
        progress = 1 - Math.max(0, w.remaining) / w.duration;
      item.ring.visible = area;
      item.fill.visible = area;
      item.lane.visible = !area;
      item.edge.visible = !area;
      item.group.rotation.y = area ? 0 : -Math.atan2(w.dz, w.dx);
      if (area) {
        item.ring.scale.setScalar(w.radius);
        item.fill.scale.setScalar(w.radius * (0.25 + progress * 0.75));
      } else {
        item.lane.scale.set(w.length, w.radius * 2, 1);
        item.lane.position.x = w.length / 2;
        item.edge.scale.set(Math.max(0.05, w.length * progress), 0.09, 1);
        item.edge.position.x = (w.length * progress) / 2;
      }
    });
    this.zones.forEach((item, i) => {
      const z = c.zones[i];
      item.group.visible = !!z;
      if (!z) return;
      item.group.position.set(z.x, 0, z.z);
      item.group.scale.setScalar(z.radius);
      item.fill.scale.setScalar(Math.min(1, z.life * 2));
    });
    this.bolts.count = this.cores.count = Math.min(
      c.projectiles.length,
      ENCOUNTER_LIMITS.projectiles,
    );
    for (let i = 0; i < this.bolts.count; i++) {
      const p = c.projectiles[i];
      this.transform.position.set(p.x, 0.45, p.z);
      this.transform.rotation.set(s.time * 4, 0, s.time * 3);
      this.transform.scale.setScalar(0.27);
      this.transform.updateMatrix();
      this.bolts.setMatrixAt(i, this.transform.matrix);
      this.transform.position.y = 0.53;
      this.transform.scale.setScalar(0.18);
      this.transform.updateMatrix();
      this.cores.setMatrixAt(i, this.transform.matrix);
    }
    this.bolts.instanceMatrix.needsUpdate = true;
    this.cores.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.root.removeFromParent();
    this.bolts.dispose();
    this.cores.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
