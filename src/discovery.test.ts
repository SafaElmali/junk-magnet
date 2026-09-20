import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createDiscoveryState,
  updateDiscovery,
  getDiscoveryHint,
  discoveryRadius,
  DISCOVERY_LIMITS,
  type DiscoveryGameState,
  type DiscoveryKind,
} from "./discovery";
import { DiscoveryView } from "./discovery-view";
import { getObstacles } from "./world";
function state(): DiscoveryGameState {
  return {
    phase: "playing",
    openingRemaining: 0,
    time: 0,
    player: { x: 0, z: 0 },
    hp: 100,
    xp: 0,
    scrap: 0,
    earnedParts: 0,
    discovery: createDiscoveryState(),
  };
}
function approach(s: DiscoveryGameState, kind: DiscoveryKind) {
  const p = s.discovery.points.find((p) => p.kind === kind && p.sector === 0)!;
  s.player = { x: p.x, z: p.z };
  return p;
}

test("discovery chest requires proximity time and rewards exactly once after revisit", () => {
  const s = state();
  const p = approach(s, "chest");
  updateDiscovery(s, 0.6);
  assert.equal(s.earnedParts, 0);
  assert.equal(getDiscoveryHint(s)?.mode, "hold");
  updateDiscovery(s, 0.61);
  assert.equal(p.completed, true);
  assert.deepEqual(
    [s.xp, s.scrap, s.earnedParts, s.discovery.chestsOpened],
    [5, 6, 3, 1],
  );
  s.player = { x: 70, z: 0 };
  updateDiscovery(s, 1);
  s.player = { x: 4, z: 0 };
  updateDiscovery(s, 5);
  assert.equal(s.earnedParts, 3);
  assert.equal(
    s.discovery.points.find((p) => p.id === "0,0:chest")?.completed,
    true,
  );
});
test("repair saves its charge at full health and caps healing", () => {
  const s = state();
  const p = approach(s, "repair");
  updateDiscovery(s, 1);
  assert.equal(p.completed, false);
  assert.equal(getDiscoveryHint(s)?.mode, "full-health");
  s.hp = 85;
  updateDiscovery(s, 0.1);
  assert.equal(s.hp, 100);
  assert.equal(s.discovery.repairsUsed, 1);
  s.hp = 50;
  updateDiscovery(s, 1);
  assert.equal(s.hp, 50);
});
test("salvage quest loses progress outside zone, then grants capped scrap and parts once", () => {
  const s = state();
  const p = approach(s, "salvage");
  updateDiscovery(s, 4);
  s.player = { x: 0, z: 0 };
  updateDiscovery(s, 2);
  assert.equal(p.progress, 3);
  s.player = { x: p.x, z: p.z };
  updateDiscovery(s, 5.01);
  assert.deepEqual(
    [s.xp, s.scrap, s.earnedParts, s.discovery.questsCompleted],
    [12, 12, 8, 1],
  );
  updateDiscovery(s, 100);
  assert.equal(s.earnedParts, 8);
});
test("pause, level selection, death and opening freeze discovery, fresh runs reset it", () => {
  const s = state();
  const p = approach(s, "chest");
  updateDiscovery(s, 0.5);
  for (const phase of ["ready", "paused", "upgrade", "lost"]) {
    s.phase = phase;
    updateDiscovery(s, 10);
    assert.equal(p.progress, 0.5);
  }
  s.phase = "playing";
  s.openingRemaining = 2;
  updateDiscovery(s, 10);
  assert.equal(p.progress, 0.5);
  assert.equal(createDiscoveryState().consumed.size, 0);
  assert.equal(
    createDiscoveryState().points.every(
      (p) => p.progress === 0 && !p.completed,
    ),
    true,
  );
});
test("streamed points are deterministic, reachable and bounded on long journeys", () => {
  const s = state();
  for (let i = -120; i <= 120; i++) {
    s.player = { x: i * 20, z: Math.round(i / 2) * 20 };
    updateDiscovery(s, 1);
    assert.ok(s.discovery.points.length <= DISCOVERY_LIMITS.points);
    assert.ok(s.discovery.consumed.size <= DISCOVERY_LIMITS.sectors);
    for (const p of s.discovery.points) {
      assert.ok(
        getObstacles(p.x, p.z).every(
          (o) =>
            Math.hypot(o.x - p.x, o.z - p.z) >
            o.radius + discoveryRadius(p.kind),
        ),
        `Clear ${p.id}`,
      );
    }
  }
  const a = state(),
    b = state();
  a.player = b.player = { x: -100, z: 80 };
  updateDiscovery(a, 0.1);
  updateDiscovery(b, 0.1);
  assert.deepEqual(a.discovery.points, b.discovery.points);
});
test("retired reward history cannot be exploited by returning after eviction", () => {
  const s = state();
  approach(s, "chest");
  updateDiscovery(s, 1.3);
  s.player = { x: 1200, z: 1200 };
  updateDiscovery(s, 0.01);
  assert.equal(s.discovery.consumed.has(0), false);
  s.player = { x: 4, z: 0 };
  updateDiscovery(s, 100);
  assert.equal(s.earnedParts, 3);
  assert.equal(
    s.discovery.points.find((p) => p.id === "0,0:chest")?.completed,
    true,
  );
});
test("render pools retain geometry across streaming and detach cleanly", () => {
  const scene = new THREE.Scene(),
    view = new DiscoveryView(scene),
    s = state();
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) geometries.add(o.geometry);
  });
  for (let i = 0; i < 100; i++) {
    s.player.x = i * 20;
    updateDiscovery(s, 0.01);
    view.update(s);
  }
  const after = new Set<THREE.BufferGeometry>();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) after.add(o.geometry);
  });
  assert.deepEqual(after, geometries);
  assert.equal(geometries.size, 4);
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test("reward feedback uses simulation time and resets for a fresh run", () => {
  const s = state();
  assert.equal(s.discovery.lastReward, null);
  s.time = 12;
  approach(s, "chest");
  updateDiscovery(s, 1.3);
  assert.deepEqual(s.discovery.lastReward, { kind: "chest", until: 15 });
  s.phase = "paused";
  updateDiscovery(s, 20);
  assert.deepEqual(s.discovery.lastReward, { kind: "chest", until: 15 });
  s.phase = "playing";
  s.time = 18;
  s.hp = 60;
  approach(s, "repair");
  updateDiscovery(s, 0.05);
  assert.deepEqual(s.discovery.lastReward, { kind: "repair", until: 21 });
  assert.equal(createDiscoveryState().lastReward, null);
});
