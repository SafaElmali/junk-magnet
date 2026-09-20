import * as THREE from "three";
import type { GameEvent, Vec } from "./simulation";

const LIMIT = 40;
const DURATION = 0.32;
const SEGMENTS_PER_ARC = 24;
type Segment = { from: THREE.Vector3; to: THREE.Vector3; width: number };
type Arc = { age: number; end: THREE.Vector3; segments: Segment[] };

/** Bounded, shared GPU batches: no new geometry/materials per lightning strike. */
export class LightningView {
  private arcs: Arc[] = [];
  private serial = 0;
  private transform = new THREE.Object3D();
  private direction = new THREE.Vector3();
  private ringColor = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  private geometry = new THREE.CylinderGeometry(1, 1, 1, 5);
  private halo = this.batch(
    this.geometry,
    0x44deff,
    LIMIT * SEGMENTS_PER_ARC,
    0.18,
  );
  private edge = this.batch(this.geometry, 0x169fcb, LIMIT * SEGMENTS_PER_ARC);
  private core = this.batch(this.geometry, 0xe7ffff, LIMIT * SEGMENTS_PER_ARC);
  private impacts = this.batch(
    new THREE.IcosahedronGeometry(1, 1),
    0xe7ffff,
    LIMIT,
  );
  private rings = this.batch(
    new THREE.RingGeometry(0.84, 1, 24),
    0x44d9f5,
    LIMIT,
    0.65,
  );

  constructor(scene: THREE.Scene) {
    scene.add(this.halo, this.edge, this.core, this.impacts, this.rings);
  }

  private batch(
    geometry: THREE.BufferGeometry,
    color: number,
    count: number,
    opacity = 1,
  ) {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        opacity,
        transparent: opacity < 1,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
      count,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Outer silhouette, white filament, then soft halo; retain world occlusion.
    mesh.renderOrder = opacity < 1 ? 13 : color === 0xe7ffff ? 12 : 11;
    return mesh;
  }

  strike(event: GameEvent, player: Vec) {
    if (this.arcs.length >= LIMIT) return;
    const start = new THREE.Vector3(
      event.fromX ?? player.x,
      0.95,
      event.fromZ ?? player.z,
    );
    const end = new THREE.Vector3(event.x, 0.95, event.z);
    const length = start.distanceTo(end);
    if (length < 0.01) return;
    const nx = -(end.z - start.z) / length,
      nz = (end.x - start.x) / length;
    const seed = ++this.serial;
    const count = Math.max(5, Math.min(12, Math.ceil(length * 2.2)));
    const amplitude = Math.min(0.43, length * 0.13);
    const points = [start];
    for (let i = 1; i < count; i++) {
      const point = start.clone().lerp(end, i / count);
      const offset =
        (i % 2 ? 1 : -1) *
        amplitude *
        (0.55 + 0.45 * Math.sin(seed * 2.7 + i * 5.3) ** 2);
      point.x += nx * offset;
      point.z += nz * offset;
      point.y += Math.sin(seed + i * 2.1) * 0.1;
      points.push(point);
    }
    points.push(end);
    const segments: Segment[] = [];
    for (let i = 1; i < points.length; i++)
      segments.push({ from: points[i - 1], to: points[i], width: 1 });
    for (const fraction of [0.3, 0.65]) {
      const index = Math.max(1, Math.floor(count * fraction));
      const from = points[index],
        side = index % 2 ? 1 : -1;
      const middle = from.clone().lerp(points[index + 1], 0.65);
      middle.x += nx * amplitude * side * 1.4;
      middle.z += nz * amplitude * side * 1.4;
      const tip = middle
        .clone()
        .addScaledVector(end.clone().sub(start).normalize(), length * 0.08);
      tip.x += nx * amplitude * side;
      tip.z += nz * amplitude * side;
      segments.push(
        { from, to: middle, width: 0.55 },
        { from: middle, to: tip, width: 0.28 },
      );
    }
    // A small star of electrical sparks marks the actual damage target.
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + seed;
      const from = end
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle) * 0.16,
            0.1,
            Math.sin(angle) * 0.16,
          ),
        );
      const to = end
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle) * 0.48,
            0.16,
            Math.sin(angle) * 0.48,
          ),
        );
      segments.push({ from, to, width: 0.45 });
    }
    this.arcs.push({ age: 0, end, segments });
  }

  update(dt: number, reduced: boolean) {
    for (const arc of this.arcs) arc.age += dt;
    this.arcs = this.arcs.filter((arc) => arc.age < DURATION);
    let index = 0;
    for (let hit = 0; hit < this.arcs.length; hit++) {
      const arc = this.arcs[hit],
        progress = arc.age / DURATION;
      const fade = Math.max(0.04, 1 - progress ** 2);
      const flicker = reduced ? 1 : 0.9 + Math.sin(arc.age * 65) * 0.1;
      for (const segment of arc.segments) {
        this.direction.subVectors(segment.to, segment.from);
        const length = this.direction.length();
        this.transform.position.copy(segment.from).lerp(segment.to, 0.5);
        this.transform.quaternion.setFromUnitVectors(
          this.up,
          this.direction.normalize(),
        );
        for (const [batch, radius] of [
          [this.halo, 0.16],
          [this.edge, 0.072],
          [this.core, 0.026],
        ] as const) {
          const width = radius * segment.width * fade * flicker;
          this.transform.scale.set(width, length, width);
          this.transform.updateMatrix();
          batch.setMatrixAt(index, this.transform.matrix);
        }
        index++;
      }
      this.transform.position.copy(arc.end);
      this.transform.quaternion.identity();
      this.transform.scale.setScalar(0.19 * fade);
      this.transform.updateMatrix();
      this.impacts.setMatrixAt(hit, this.transform.matrix);
      this.transform.rotation.x = -Math.PI / 2;
      this.transform.scale.setScalar(reduced ? 0.4 : 0.2 + progress * 0.65);
      this.transform.updateMatrix();
      this.rings.setMatrixAt(hit, this.transform.matrix);
      this.rings.setColorAt(
        hit,
        this.ringColor.setHex(0x44d9f5).multiplyScalar(fade),
      );
    }
    for (const batch of [
      this.halo,
      this.edge,
      this.core,
      this.impacts,
      this.rings,
    ]) {
      batch.count =
        batch === this.impacts || batch === this.rings
          ? this.arcs.length
          : index;
      batch.instanceMatrix.needsUpdate = true;
    }
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }

  diagnostics() {
    return { arcs: this.arcs.length, segments: this.core.count, limit: LIMIT };
  }
  clear() {
    this.arcs.length = 0;
    this.update(0, true);
  }
}
