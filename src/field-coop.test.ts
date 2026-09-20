import test from "node:test";
import assert from "node:assert/strict";
import { CoopSession } from "./coop-session";
import { DEFAULT_RUN_CONFIG } from "./progression";
const zero = { x: 0, z: 0 };
function quiet() {
  const c = new CoopSession([DEFAULT_RUN_CONFIG, DEFAULT_RUN_CONFIG], "field-test");
  c.players[0].enemies = []; c.players[0].pickups = []; c.players[0].spawnTimer = 999;
  return c;
}
test("co-op drone roles remain actor-specific and authoritative", () => {
  const c = quiet();
  assert.equal(c.droneMode(1, "guard"), true);
  assert.equal(c.droneMode(1, "invalid" as never), false);
  c.tick(0.05, [zero, zero]);
  assert.equal(c.players[0].drone.mode, "collector");
  assert.equal(c.players[1].drone.mode, "guard");
  assert.equal(c.snapshot(0).partner.drone.mode, "guard");
  c.players[1].hp = 0;
  assert.equal(c.droneMode(1, "repair"), false);
  c.finished = true;
  assert.equal(c.droneMode(0, "repair"), false);
});
test("co-op rank-three branch decision never freezes the world and rejects stale or wrong branches", () => {
  const c = quiet(), p = c.players[0];
  p.upgrades.saw = 2; p.choices = ["saw"]; p.level = 3;
  assert.equal(c.choose(0, "saw", 3), true);
  assert.equal(p.phase, "playing");
  assert.deepEqual(p.specializationChoices, ["saw_reaper", "saw_rail"]);
  p.xp = 30;
  c.tick(0.05, [zero, zero]);
  assert.equal(p.level, 3);
  assert.equal(p.xp, 30);
  assert.equal(c.specialize(0, "saw_rail", 2), false);
  assert.equal(c.specialize(0, "turret_sniper", 3), false);
  assert.equal(c.specialize(1, "saw_rail", 3), false);
  assert.equal(c.specialize(0, "saw_rail", 3), true);
  assert.equal(p.specializations.saw, "saw_rail");
  assert.equal(p.phase, "playing");
  assert.equal(p.level, 4);
  assert.equal(c.specialize(0, "saw_reaper", 3), false);
});

test("drone upgrades stay per-player, cap at three and synchronize rank and emergency charge", () => {
  const c = quiet(), p = c.players[1];
  for (let rank = 1; rank <= 3; rank++) {
    p.choices = ["drone_repair"]; p.level = rank + 1;
    assert.equal(c.choose(1, "drone_repair", p.level - 1), false);
    assert.equal(c.choose(1, "drone_repair", p.level), true);
    assert.equal(p.upgrades.drone_repair, rank);
    assert.equal(p.phase, "playing");
    assert.deepEqual(p.specializationChoices, []);
  }
  p.choices = ["drone_repair"];
  assert.equal(c.choose(1, "drone_repair", p.level), false);
  assert.equal(c.players[0].upgrades.drone_repair, 0);
  assert.equal(p.upgrades.drone_collector, 0);
  assert.equal(p.upgrades.drone_guard, 0);
  p.openingRemaining = 0;
  p.hp = 20;
  c.droneMode(1, "repair");
  c.tick(0.05, [zero, zero]);
  assert.equal(p.hp, 40);
  const snapshot = JSON.parse(JSON.stringify(c.snapshot(0)));
  assert.equal(snapshot.partner.upgrades.drone_repair, 3);
  assert.equal(snapshot.partner.drone.emergencyUsed, true);
  assert.equal(c.snapshot(1).state.upgrades.drone_repair, 3);
});
