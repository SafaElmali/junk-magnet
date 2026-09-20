import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createDroneState, setDroneMode, updateDrone, type DroneGameState, type DroneHooks } from "./drone";
import { DroneView } from "./drone-view";

const hooks: DroneHooks = { damage: (enemy, damage) => { enemy.hp -= damage; }, emit: () => {} };
function state(): DroneGameState {
  return {
    drone: createDroneState(), player: { x: 0, z: 0 }, facing: { x: 0, z: 1 },
    phase: "playing", openingRemaining: 0, time: 10, hp: 100, scrap: 0, pickups: [], enemies: [],
  };
}
test("collector retrieves existing distant salvage without granting or duplicating it", () => {
  const s = state();
  const pickup = { id: 1, kind: "scrap" as const, x: 6, z: 0, born: 0, value: 7 };
  s.pickups.push(pickup);
  for (let i = 0; i < 120; i++) updateDrone(s, 1 / 60, hooks);
  assert.ok(pickup.x < 3.2, "drone brings salvage into normal collection range");
  assert.equal(s.scrap, 0, "normal collection retains sole ownership of grants");
  assert.equal(s.pickups.length, 1);
  assert.equal(s.pickups[0], pickup);
  assert.equal(pickup.value, 7);
});
test("collector respects full capacity, fresh drops, and tutorial", () => {
  for (const setup of [
    (s: DroneGameState) => { s.scrap = 12; },
    (s: DroneGameState) => { s.time = 0.1; },
    (s: DroneGameState) => { s.openingRemaining = 1; },
  ]) {
    const s = state();
    s.pickups.push({ id: 1, kind: "scrap", x: 5, z: 0, born: 0 });
    setup(s);
    for (let i = 0; i < 120; i++) updateDrone(s, 1 / 60, hooks);
    assert.equal(s.pickups[0].x, 5);
  }
});
test("co-op collectors give shared salvage one stable owner instead of tugging twice", () => {
  const a = state(), b = state();
  b.player.x = 10;
  a.drone.x = b.drone.x = 5;
  a.drone.z = b.drone.z = 0;
  const pickup = { id: 1, kind: "scrap" as const, x: 5, z: 0, born: 0 };
  a.pickups = b.pickups = [pickup];
  const shared = { ...hooks, players: [a, b] };
  // A stable tie-break uses the shared roster, not the current update order.
  updateDrone(b, 0.1, shared);
  assert.equal(pickup.x, 5);
  updateDrone(a, 0.1, shared);
  assert.equal(pickup.x, 4.2);
  updateDrone(b, 0.1, shared);
  assert.equal(pickup.x, 4.2);
  a.hp = 0;
  b.drone.x = pickup.x;
  updateDrone(b, 0.1, shared);
  assert.equal(pickup.x, 5, "surviving helper takes over salvage");
});
test("repair caps healing, cannot revive and role switching cannot farm charges", () => {
  const s = state();
  s.hp = 99;
  assert.equal(setDroneMode(s, "repair"), true);
  updateDrone(s, 4.9, hooks);
  assert.equal(s.hp, 99);
  updateDrone(s, 0.11, hooks);
  assert.equal(s.hp, 100);
  s.hp = 50;
  setDroneMode(s, "collector");
  updateDrone(s, 0.5, hooks);
  setDroneMode(s, "repair");
  updateDrone(s, 0.5, hooks);
  assert.equal(s.hp, 50);
  updateDrone(s, 4.5, hooks);
  assert.equal(s.hp, 53);
  s.hp = 0;
  updateDrone(s, 10, hooks);
  assert.equal(s.hp, 0);
});
test("guard hits closest living target through reward-aware hook on a bounded cadence", () => {
  const s = state();
  s.enemies = [
    { id: 1, x: 1, z: 0, hp: 0, hit: 0, seed: 0, type: "can" },
    { id: 2, x: 2, z: 0, hp: 5, hit: 0, seed: 0, type: "can" },
    { id: 3, x: 4, z: 0, hp: 5, hit: 0, seed: 0, type: "can" },
  ];
  let hits = 0;
  const guardHooks: DroneHooks = { ...hooks, damage: (enemy, damage) => { hits++; hooks.damage(enemy, damage); } };
  setDroneMode(s, "guard");
  updateDrone(s, 2, guardHooks);
  assert.equal(s.enemies[1].hp, 2);
  assert.equal(s.enemies[2].hp, 5);
  updateDrone(s, 0.5, guardHooks);
  assert.equal(hits, 1);
  updateDrone(s, 1.5, guardHooks);
  assert.equal(hits, 2);
  updateDrone(s, 2, guardHooks);
  assert.equal(s.enemies[2].hp, 2);
});
test("paused drone state stays frozen and mode input is validated", () => {
  const s = state();
  s.phase = "paused";
  const before = structuredClone(s);
  updateDrone(s, 20, hooks);
  assert.equal(setDroneMode(s, "guard"), false);
  assert.deepEqual(s, before);
  s.phase = "playing";
  assert.equal(setDroneMode(s, "bad" as "guard"), false);
  updateDrone(s, Number.NaN, hooks);
  assert.ok(Number.isFinite(s.drone.x));
});
test("drone renderer reuses bounded meshes and removes owned GPU resources", () => {
  const scene = new THREE.Scene();
  const view = new DroneView(scene);
  let count = 0;
  scene.traverse(() => count++);
  for (let i = 0; i < 120; i++) {
    const drone = createDroneState();
    drone.mode = i % 2 ? "repair" : "guard";
    drone.pulse = 0.3;
    view.update({ drone, time: i / 60 }, i % 3 === 0);
  }
  let after = 0;
  scene.traverse(() => after++);
  assert.equal(after, count);
  view.clear();
  assert.ok(scene.children.every(child => !child.visible));
  view.update({ drone: createDroneState(), time: 0, hp: 0 });
  assert.ok(scene.children.every(child => !child.visible));
  view.dispose();
  assert.equal(scene.children.length, 0);
});


test("Blender drone switches actual role tools and owns materials without destroying shared geometry", async () => {
  const bytes = await readFile(new URL("../public/models/helper-drone.glb", import.meta.url));
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  for (const name of ["Fan_L", "Fan_R", "Tool_Collector", "Tool_Repair", "Tool_Guard"]) assert.ok(asset.scene.getObjectByName(name), name);
  const scene = new THREE.Scene(), view = new DroneView(scene);
  view.setModel(asset.scene);
  let count = 0, disposed = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  asset.scene.traverse(o => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
  for (const geometry of geometries) geometry.addEventListener("dispose", () => disposed++);
  scene.traverse(() => count++);
  const drone = createDroneState();
  for (const [mode, name] of [["collector", "Tool_Collector"], ["repair", "Tool_Repair"], ["guard", "Tool_Guard"]] as const) {
    drone.mode = mode; drone.pulse = .2;
    view.update({ drone, time: 1 });
    for (const tool of ["Tool_Collector", "Tool_Repair", "Tool_Guard"]) assert.equal(scene.getObjectByName(tool)!.visible, tool === name);
  }
  const status = scene.getObjectByName("Shell_Drone_Status") as THREE.Mesh;
  const original = asset.scene.getObjectByName("Shell_Drone_Status") as THREE.Mesh;
  assert.notEqual(status.material, original.material);
  assert.equal(status.geometry, original.geometry);
  const fan = scene.getObjectByName("Fan_L")!;
  view.update({ drone, time: 2 }, true);
  assert.equal(fan.rotation.y, 0);
  let after = 0; scene.traverse(() => after++); assert.equal(count, after);
  view.dispose(); assert.equal(disposed, 0); assert.equal(scene.children.length, 0);
});
