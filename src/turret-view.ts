import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Shared, toy-machined scrap sentry. Only the upper assembly turns to aim. */
export function createTurretTemplate() {
  const material = (color: number, metalness = 0.25) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.48 });
  const ink = material(0x173342);
  const teal = material(0x459b9c);
  const gold = material(0xf3c74c, 0.35);
  const steel = material(0xa2aca6, 0.65);
  const cream = material(0xfff4d8);
  const lens = new THREE.MeshStandardMaterial({
    color: 0x9cf4ed,
    emissive: 0x3bbdb7,
    emissiveIntensity: 0.65,
    roughness: 0.22,
  });
  const root = new THREE.Group();
  root.name = "scrap-turret";
  const chassis = new THREE.Group();
  chassis.name = "chassis";
  const head = new THREE.Group();
  head.name = "head";
  const barrels = new THREE.Group();
  barrels.name = "barrels";

  const part = (
    group: THREE.Group,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const box = (
    group: THREE.Group,
    surface: THREE.Material,
    size: [number, number, number],
    position: [number, number, number],
    radius = 0.035,
  ) =>
    part(
      group,
      new RoundedBoxGeometry(...size, 1, radius),
      surface,
      ...position,
    );
  const cylinder = (
    group: THREE.Group,
    surface: THREE.Material,
    radius: number,
    length: number,
    position: [number, number, number],
    forward = false,
  ) => {
    const mesh = part(
      group,
      new THREE.CylinderGeometry(radius, radius, length, 12),
      surface,
      ...position,
    );
    if (forward) mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  // Four outriggers keep the silhouette planted as the weapon tracks a target.
  cylinder(chassis, ink, 0.43, 0.22, [0, 0.2, 0]);
  cylinder(chassis, steel, 0.35, 0.07, [0, 0.34, 0]);
  cylinder(chassis, gold, 0.24, 0.18, [0, 0.43, 0]);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const arm = box(
        chassis,
        teal,
        [0.22, 0.18, 0.54],
        [x * 0.34, 0.2, z * 0.34],
      );
      arm.rotation.y = (x * z * Math.PI) / 4;
      const foot = box(
        chassis,
        ink,
        [0.32, 0.14, 0.36],
        [x * 0.5, 0.09, z * 0.5],
      );
      foot.rotation.y = (x * z * Math.PI) / 4;
      cylinder(chassis, steel, 0.055, 0.035, [x * 0.5, 0.175, z * 0.5]);
    }
  }

  box(head, ink, [0.76, 0.16, 0.65], [0, 0.56, -0.04]);
  box(head, teal, [0.88, 0.45, 0.66], [0, 0.8, -0.06], 0.08);
  box(head, gold, [0.73, 0.13, 0.59], [0, 1.055, -0.07], 0.045);
  box(head, cream, [0.12, 0.018, 0.48], [0, 1.126, -0.06], 0.006);
  // Rear radiator, side armor, and exposed fasteners read as salvaged machinery.
  box(head, ink, [0.53, 0.25, 0.1], [0, 0.81, -0.42]);
  for (const x of [-0.18, -0.06, 0.06, 0.18])
    box(head, steel, [0.035, 0.19, 0.035], [x, 0.81, -0.478], 0.006);
  for (const side of [-1, 1]) {
    box(head, gold, [0.085, 0.28, 0.36], [side * 0.46, 0.81, -0.08]);
    for (const z of [-0.19, 0.04]) {
      const rivet = cylinder(head, steel, 0.035, 0.025, [side * 0.51, 0.81, z]);
      rivet.rotation.z = Math.PI / 2;
    }
    cylinder(head, ink, 0.135, 0.12, [side * 0.235, 0.81, 0.29], true);
    cylinder(barrels, steel, 0.082, 0.52, [side * 0.235, 0.81, 0.57], true);
    cylinder(barrels, gold, 0.108, 0.09, [side * 0.235, 0.81, 0.49], true);
    cylinder(barrels, ink, 0.126, 0.2, [side * 0.235, 0.81, 0.87], true);
    cylinder(barrels, steel, 0.128, 0.045, [side * 0.235, 0.81, 0.955], true);
    cylinder(barrels, ink, 0.077, 0.008, [side * 0.235, 0.81, 0.981], true);
  }
  box(head, ink, [0.24, 0.17, 0.12], [0, 0.97, 0.3]);
  box(head, lens, [0.16, 0.085, 0.018], [0, 0.98, 0.369], 0.015);

  // Bake static details together by material: cloned turrets reuse every GPU
  // resource and cost only 13 meshes each, including the recoiling barrels.
  for (const assembly of [chassis, head, barrels]) {
    const surfaces = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of assembly.children) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      mesh.updateMatrix();
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      const pieces = surfaces.get(mesh.material) ?? [];
      pieces.push(geometry);
      surfaces.set(mesh.material, pieces);
      mesh.geometry.dispose();
    }
    assembly.clear();
    for (const [surface, pieces] of surfaces) {
      const mesh = new THREE.Mesh(mergeGeometries(pieces, false)!, surface);
      pieces.forEach((geometry) => geometry.dispose());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      assembly.add(mesh);
    }
  }
  head.add(barrels);
  root.add(chassis, head);
  return root;
}
