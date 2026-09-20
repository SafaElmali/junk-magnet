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
    upgrades: { drone_collector: 0, drone_repair: 0, drone_guard: 0 },
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
    drone.specialPulse = 0.4;
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

test("each drone rank improves retrieval reach, healing cadence and guard fire", () => {
  for (const rank of [1, 2, 3]) {
    const collector = state();
    collector.upgrades.drone_collector = rank;
    collector.drone.actionTimer = 100;
    const pickup = { id: 1, kind: "xp" as const, x: 6 + 2 * rank, z: 0, born: 0 };
    collector.pickups = [pickup];
    for (let i = 0; i < 180; i++) updateDrone(collector, 1 / 60, hooks);
    assert.ok(pickup.x < 3.2, `rank ${rank} retrieves beyond the base range`);
    const repair = state();
    repair.upgrades.drone_repair = rank;
    repair.hp = 50;
    setDroneMode(repair, "repair");
    const interval = 5 - rank * 0.5;
    updateDrone(repair, interval - 0.01, hooks);
    assert.equal(repair.hp, 50);
    updateDrone(repair, 0.02, hooks);
    assert.equal(repair.hp, 53 + rank);
    assert.equal(repair.drone.actionTimer, interval);
    const guard = state();
    guard.upgrades.drone_guard = rank;
    guard.enemies = [{ id: 1, x: 2, z: 0, hp: 100, hit: 0, seed: 0, type: "can" }];
    setDroneMode(guard, "guard");
    updateDrone(guard, 2, hooks);
    assert.equal(guard.enemies[0].hp, 97 - 2 * rank);
    assert.equal(guard.drone.actionTimer, 2 - rank * 0.25);
    assert.equal(guard.enemies[0].slowUntil, rank === 3 ? 11 : undefined);
  }
});

test("max-rank cluster pulls at most five existing eligible pickups on a six-second cooldown", () => {
  const s = state();
  s.upgrades.drone_collector = 3;
  s.drone.actionTimer = 0;
  s.scrap = 12;
  s.pickups = Array.from({ length: 7 }, (_, i) => ({ id: i, kind: "xp" as const, x: 10 + i * 0.1, z: 0, born: 0, value: 2 }));
  s.pickups.push({ id: 20, kind: "scrap", x: 8, z: 0, born: 0 });
  s.pickups.push({ id: 21, kind: "xp", x: 8, z: 0, born: 10 });
  s.pickups.push({ id: 22, kind: "xp", x: 14, z: 0, born: 0 });
  const before = structuredClone(s.pickups);
  updateDrone(s, 0.01, hooks);
  assert.equal(s.pickups.filter((p, i) => p.x !== before[i].x).length, 5);
  assert.equal(s.pickups.length, before.length);
  assert.equal(s.scrap, 12);
  assert.equal(s.drone.actions, 1);
  assert.equal(s.drone.actionTimer, 6);
  assert.ok(s.drone.specialPulse > 0);
  updateDrone(s, 0.1, hooks);
  assert.equal(s.drone.actions, 1);
  assert.ok(s.pickups.slice(0, 7).every(p => p.value === 2));
  setDroneMode(s, "repair");
  updateDrone(s, 0.5, hooks);
  setDroneMode(s, "collector");
  assert.equal(s.drone.actionTimer, 6, "switching back cannot grant another pull");
  updateDrone(s, 6, hooks);
  assert.equal(s.drone.actions, 2);
});

test("cluster ownership respects different co-op drone ranges and never tugs a partner's pickup", () => {
  const a = state(), b = state();
  a.upgrades.drone_collector = 3;
  a.drone.actionTimer = 0;
  b.player.x = 20;
  const distant = { id: 1, kind: "xp" as const, x: 12, z: 0, born: 0 };
  const partner = { id: 2, kind: "xp" as const, x: 16, z: 0, born: 0 };
  a.pickups = b.pickups = [distant, partner];
  updateDrone(a, 0.01, { ...hooks, players: [a, b] });
  assert.equal(distant.x, 8, "closer partner is out of base drone range");
  assert.equal(partner.x, 16, "partner owns its in-range pickup");
});

test("emergency repair is stored until low health in Repair mode, consumed once and never revives", () => {
  const s = state();
  s.upgrades.drone_repair = 3;
  s.hp = 20;
  s.drone.actionTimer = 10;
  updateDrone(s, 0.1, hooks);
  assert.equal(s.hp, 20, "Collector mode cannot spend the heal");
  setDroneMode(s, "repair");
  updateDrone(s, 0.1, hooks);
  assert.equal(s.hp, 40);
  assert.equal(s.drone.emergencyUsed, true);
  s.hp = 20;
  updateDrone(s, 0.5, hooks);
  setDroneMode(s, "guard");
  updateDrone(s, 0.5, hooks);
  setDroneMode(s, "repair");
  updateDrone(s, 0.1, hooks);
  assert.equal(s.hp, 20, "role switching does not replenish the charge");
  const fresh = state();
  fresh.upgrades.drone_repair = 3;
  fresh.hp = 31;
  setDroneMode(fresh, "repair");
  updateDrone(fresh, 0.1, hooks);
  assert.equal(fresh.hp, 31);
  assert.equal(fresh.drone.emergencyUsed, false);
  fresh.hp = 0;
  updateDrone(fresh, 10, hooks);
  assert.equal(fresh.hp, 0);
  assert.equal(fresh.drone.emergencyUsed, false);
  fresh.hp = 30;
  updateDrone(fresh, 0.1, hooks);
  assert.equal(fresh.hp, 50);
  assert.equal(fresh.drone.emergencyUsed, true);
  assert.equal(createDroneState().emergencyUsed, false);
});

test("maxing Collector never grants Repair or Guard stats or final-rank abilities", () => {
  const s = state();
  s.upgrades.drone_collector = 3;
  s.hp = 20;
  setDroneMode(s, "repair");
  updateDrone(s, 5, hooks);
  assert.equal(s.hp, 23);
  assert.equal(s.drone.emergencyUsed, false);
  assert.equal(s.drone.actionTimer, 5);
  s.enemies = [{ id: 1, x: 2, z: 0, hp: 100, hit: 0, seed: 0, type: "can" }];
  setDroneMode(s, "guard");
  updateDrone(s, 5, hooks);
  assert.equal(s.enemies[0].hp, 97);
  assert.equal(s.enemies[0].slowUntil, undefined);
  assert.equal(s.drone.actionTimer, 2);
});

test("maxing Repair and Guard never grants Collector reach or cluster pulls", () => {
  const s = state();
  s.upgrades.drone_repair = s.upgrades.drone_guard = 3;
  s.drone.actionTimer = 0;
  const pickup = { id: 1, kind: "xp" as const, x: 10, z: 0, born: 0 };
  s.pickups = [pickup];
  for (let i = 0; i < 120; i++) updateDrone(s, 1 / 60, hooks);
  assert.equal(pickup.x, 10);
  assert.equal(s.drone.actions, 0);
});
