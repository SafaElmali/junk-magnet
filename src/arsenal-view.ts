import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ENTITY_LIMITS, enemyRadius, type State } from "./simulation";
import { ARSENAL_LIMITS, SLAG } from "./arsenal";

/** A soft radial falloff shared by slag glow and elite auras. */
function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!;
  const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.8)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function painted(geometry: THREE.BufferGeometry, hex: number) {
  const part = geometry.index ? geometry.toNonIndexed() : geometry;
  const color = new THREE.Color(hex);
  const colors = new Float32Array(part.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  part.deleteAttribute("uv");
  return part;
}
/** A red magnet head with steel barbs; +Z points along the throw. */
function hookGeometry() {
  const tip = new THREE.ConeGeometry(0.13, 0.34, 8);
  tip.rotateX(Math.PI / 2);
  tip.translate(0, 0, 0.3);
  const shank = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
  shank.rotateX(Math.PI / 2);
  const eye = new THREE.TorusGeometry(0.09, 0.03, 5, 10);
  eye.translate(0, 0, -0.3);
  const barbs = [-1, 1].map((side) => {
    const barb = new THREE.ConeGeometry(0.05, 0.24, 5);
    barb.rotateX(-Math.PI / 2);
    barb.rotateY(side * 0.6);
    barb.translate(side * 0.1, 0, 0.1);
    return painted(barb, 0xd8e0da);
  });
  const merged = mergeGeometries([
    painted(tip, 0xd2513a),
    painted(shank, 0xb9c4bf),
    painted(eye, 0x3b4a4d),
    ...barbs,
  ])!;
  merged.computeVertexNormals();
  return merged;
}
/** Harpoons, slag and elite halos. Fixed-capacity batches: no per-frame allocation. */
export class ArsenalView {
  private hooks: THREE.InstancedMesh;
  private cables: THREE.InstancedMesh;
  private shells: THREE.InstancedMesh;
  private crust: THREE.InstancedMesh;
  private glow: THREE.InstancedMesh;
  private halos: THREE.InstancedMesh;
  private auras: THREE.InstancedMesh;
  private transform = new THREE.Object3D();
  private color = new THREE.Color();
  private direction = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private forward = new THREE.Vector3(0, 0, 1);
  private counts = { hooks: 0, shells: 0, puddles: 0, elites: 0 };
  constructor(scene: THREE.Scene) {
    const texture = glowTexture();
    const flat = (geometry: THREE.BufferGeometry) => geometry.rotateX(-Math.PI / 2);
    const batch = (geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number, order = 0) => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    };
    this.hooks = batch(
      hookGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.35 }),
      ARSENAL_LIMITS.harpoons * 2,
    );
    this.hooks.castShadow = true;
    this.cables = batch(
      new THREE.CylinderGeometry(1, 1, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0x33403f, metalness: 0.4, roughness: 0.6 }),
      ARSENAL_LIMITS.harpoons * 2,
    );
    this.shells = batch(
      new THREE.IcosahedronGeometry(0.3, 1),
      new THREE.MeshBasicMaterial({ color: 0xff8c2e, toneMapped: false }),
      ARSENAL_LIMITS.shells * 2,
    );
    this.shells.castShadow = true;
    // Slag reads by shape and value as well as hue: a dark crust disc under a bright core.
    this.crust = batch(
      flat(new THREE.CircleGeometry(1, 28)),
      new THREE.MeshStandardMaterial({ color: 0x3a1b10, emissive: 0x3d1204, roughness: 0.95 }),
      ARSENAL_LIMITS.puddles * 2,
    );
    this.crust.receiveShadow = true;
    this.glow = batch(
      flat(new THREE.CircleGeometry(1, 28)),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
      ARSENAL_LIMITS.puddles * 2,
      2,
    );
    this.auras = batch(
      flat(new THREE.CircleGeometry(1, 24)),
      new THREE.MeshBasicMaterial({ map: texture, color: 0xffb640, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
      ENTITY_LIMITS.enemies,
      1,
    );
    this.halos = batch(
      flat(new THREE.RingGeometry(0.76, 1, 40)),
      new THREE.MeshBasicMaterial({ color: 0xffc444, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
      ENTITY_LIMITS.enemies,
      3,
    );
  }
  private finish(mesh: THREE.InstancedMesh, count: number) {
    if (!count && !mesh.count) return;
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  update(s: State, reduced: boolean) {
    const t = this.transform,
      a = s.arsenal;
    let hooks = 0;
    for (const h of a?.harpoons ?? []) {
      // The head always points away from its robot, so a reeling hook trails its cable.
      this.direction.set(h.x - h.ox, 0, h.z - h.oz);
      const length = this.direction.length();
      if (length < 0.05) continue;
      this.direction.divideScalar(length);
      t.position.set(h.x, 0.6, h.z);
      t.quaternion.setFromUnitVectors(this.forward, this.direction);
      t.scale.setScalar(1.5);
      t.updateMatrix();
      this.hooks.setMatrixAt(hooks, t.matrix);
      t.position.set((h.x + h.ox) / 2, 0.58, (h.z + h.oz) / 2);
      t.quaternion.setFromUnitVectors(this.up, this.direction);
      t.scale.set(0.035, length, 0.035);
      t.updateMatrix();
      this.cables.setMatrixAt(hooks++, t.matrix);
    }
    this.finish(this.hooks, hooks);
    this.finish(this.cables, hooks);
    let shells = 0;
    for (const shell of a?.shells ?? []) {
      t.position.set(shell.x, 0.7 + SLAG.arc * 4 * shell.t * (1 - shell.t), shell.z);
      t.rotation.set(0, reduced ? 0 : s.time * 6 + shell.id, 0);
      t.scale.setScalar(1);
      t.updateMatrix();
      this.shells.setMatrixAt(shells++, t.matrix);
    }
    this.finish(this.shells, shells);
    let puddles = 0;
    for (const p of a?.puddles ?? []) {
      // Cooling puddles shrink over their final half second; molten pools burn paler.
      const cooling = Math.min(1, p.life / 0.5);
      const bubble = reduced ? 1 : 1 + Math.sin(s.time * 5 + p.id) * 0.04;
      t.rotation.set(0, 0, 0);
      t.position.set(p.x, 0.028, p.z);
      t.scale.setScalar(p.radius * (0.6 + cooling * 0.4));
      t.updateMatrix();
      this.crust.setMatrixAt(puddles, t.matrix);
      t.position.y = 0.05;
      t.scale.setScalar(p.radius * 0.92 * cooling * bubble);
      t.updateMatrix();
      this.glow.setMatrixAt(puddles, t.matrix);
      this.color.setHex(p.slow ? 0xffb030 : 0xff7a26).multiplyScalar(0.55 + cooling * 0.45);
      this.glow.setColorAt(puddles++, this.color);
    }
    this.finish(this.crust, puddles);
    this.finish(this.glow, puddles);
    let elites = 0;
    for (const e of s.enemies) {
      if (!e.elite || e.hp <= 0) continue;
      const r = enemyRadius(e),
        pulse = reduced ? 1 : 1 + Math.sin(s.time * 4 + e.seed) * 0.07;
      t.rotation.set(0, 0, 0);
      t.position.set(e.x, 0.04, e.z);
      t.scale.setScalar(r * 2.3);
      t.updateMatrix();
      this.auras.setMatrixAt(elites, t.matrix);
      t.position.y = 0.06;
      t.scale.setScalar(r * 1.85 * pulse);
      t.updateMatrix();
      this.halos.setMatrixAt(elites++, t.matrix);
    }
    this.finish(this.auras, elites);
    this.finish(this.halos, elites);
    const counts = this.counts;
    counts.hooks = hooks;
    counts.shells = shells;
    counts.puddles = puddles;
    counts.elites = elites;
  }
  diagnostics() {
    return { ...this.counts };
  }
  clear() {
    for (const mesh of [this.hooks, this.cables, this.shells, this.crust, this.glow, this.auras, this.halos])
      mesh.count = 0;
    Object.assign(this.counts, { hooks: 0, shells: 0, puddles: 0, elites: 0 });
  }
}
