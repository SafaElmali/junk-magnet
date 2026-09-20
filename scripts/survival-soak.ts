import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { createState, update, chooseUpgrade, type UpgradeId } from "../src/simulation";

const priority: UpgradeId[] = ["lightning", "burst", "turret", "saw", "armor", "magnet", "boots", "repair"];
const results = [];
for (const protectedPlayer of [false, true]) {
  const s = createState();
  s.phase = "playing";
  const peaks = { enemies: 0, pickups: 0, shots: 0, turrets: 0 };
  const seen = new Set<string>();
  const began = performance.now();
  for (let frame = 0; frame < 20 * 60 * 12 && s.phase !== "lost"; frame++) {
    if (s.phase === "upgrade") {
      const choice = priority.find(id => s.choices.includes(id)) ?? s.choices[0];
      assert.ok(choice, "Level-up has a choice");
      assert.equal(chooseUpgrade(s, choice), true);
      continue;
    }
    // Protected run is a simulation stress fixture, not a normal survival result.
    if (protectedPlayer) s.immunity = 100;
    // Walk a wide figure eight; gather drops if close enough to detour.
    const target = s.pickups.filter(p => p.kind === "xp").sort((a, b) =>
      Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
    const dx = target ? target.x - s.player.x : Math.cos(s.time / 12);
    const dz = target ? target.z - s.player.z : Math.sin(s.time / 6);
    const length = Math.hypot(dx, dz) || 1;
    update(s, 0.05, { x: dx / length, z: dz / length });
    s.events = [];
    s.enemies.forEach(e => seen.add(e.type));
    peaks.enemies = Math.max(peaks.enemies, s.enemies.length);
    peaks.pickups = Math.max(peaks.pickups, s.pickups.length);
    peaks.shots = Math.max(peaks.shots, s.shots.length);
    peaks.turrets = Math.max(peaks.turrets, s.turrets.length);
    assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.z));
  }
  if (protectedPlayer) {
    assert.ok(s.time > 600, "Stress fixture ran over ten simulated minutes");
    assert.ok(s.spawned > 36 && s.kills > 36, "Run continues past former victory condition");
    assert.equal(seen.size, 3, "All enemy types entered the run");
    assert.ok(peaks.enemies <= 250 && peaks.pickups <= 1024 && peaks.shots <= 256 && peaks.turrets <= 12, "Entity storage is bounded");
  }
  results.push({ protectedPlayer, seconds: s.time, level: s.level, kills: s.kills, spawned: s.spawned, hp: s.hp, upgrades: s.upgrades, peaks, enemyTypes: [...seen], simulationWallMs: Math.round(performance.now() - began) });
}
mkdirSync(".impeccable/review", { recursive: true });
writeFileSync(".impeccable/review/survival-soak.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
