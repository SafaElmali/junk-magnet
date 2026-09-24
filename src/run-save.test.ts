import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  update,
  chooseUpgrade,
  chooseSpecialization,
  ENTITY_LIMITS,
  type State,
} from "./simulation";
import { ENCOUNTER_LIMITS } from "./encounters";
import { DISCOVERY_LIMITS } from "./discovery";
import { DEFAULT_RUN_CONFIG } from "./progression";
import { createRunAnalytics } from "./run-analytics";
import {
  RUN_SAVE_KEY,
  RUN_SAVE_VERSION,
  clearRun,
  isResumable,
  loadRun,
  parseRun,
  saveRun,
  serializeRun,
  stateShape,
} from "./run-save";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}
const steer = (s: State) => ({ x: Math.cos(s.time / 7), z: Math.sin(s.time / 4) });
/** Deterministic play: fixed steps, steering from the clock and first choices. */
function play(s: State, seconds: number, stopAtUpgrade = false) {
  const end = s.time + seconds;
  while (s.time < end) {
    if (s.phase === "upgrade") {
      if (stopAtUpgrade) return;
      if (s.specializationChoices.length)
        chooseSpecialization(s, s.specializationChoices[0]);
      else chooseUpgrade(s, s.choices[0]);
      continue;
    }
    // A protected robot keeps the run alive long enough to fill the yard.
    s.immunity = 100;
    update(s, 1 / 20, steer(s));
  }
}
function started(seed = 7) {
  const s = createState({ ...DEFAULT_RUN_CONFIG, seed, rerolls: 1, banishes: 1 });
  s.phase = "playing";
  return s;
}

test("a restored run equals the original and simulates identically", () => {
  const s = started();
  play(s, 100);
  play(s, 60, true);
  assert.equal(s.phase, "upgrade", "saved during a level-up choice");
  assert.ok(s.kills > 20 && s.level > 3 && s.encounters.defeated + s.encounters.sequence > 0);
  const restored = parseRun(serializeRun(s, "run-a", 1234));
  assert.ok(restored);
  assert.equal(restored.runId, "run-a");
  assert.equal(restored.savedAt, 1234);
  assert.deepEqual(restored.state, s);
  assert.ok(restored.state.encounters.brains instanceof Map);
  assert.ok(restored.state.discovery.consumed instanceof Map);
  assert.deepEqual(restored.state.choices, s.choices);
  // The pending choice, then another minute, play out the same way.
  for (const run of [s, restored.state]) {
    assert.equal(chooseUpgrade(run, run.choices[0]), true);
    play(run, 60);
  }
  assert.ok(s.time >= 160);
  assert.deepEqual(restored.state, s);
});

test("the codec keeps maps, sets, special numbers, undefined, shared objects and cycles", () => {
  const s = started();
  play(s, 5);
  const shared = { hits: [1, 2] };
  const loop: { self?: unknown; name: string } = { name: "loop" };
  loop.self = loop;
  // A field another feature might add; nothing lists State's fields.
  Object.assign(s, {
    extra: {
      map: new Map<unknown, unknown>([[1, { a: shared }], ["k", new Set([shared, "x"])]]),
      numbers: [NaN, Infinity, -Infinity, -0, 0, 1e-300],
      missing: undefined,
      holes: [undefined, 3],
      tagLike: { $jm: "ref", v: 0 },
      first: shared,
      second: shared,
      loop,
    },
  });
  const back = parseRun(serializeRun(s, "run-b"))!.state as State & {
    extra: Record<string, any>;
  };
  assert.deepEqual(back, s);
  const extra = back.extra;
  assert.equal(extra.first, extra.second, "shared references stay shared");
  assert.equal(extra.map.get(1).a, extra.first);
  assert.ok(extra.map.get("k").has(extra.first));
  assert.equal(extra.loop.self, extra.loop);
  assert.ok(Object.is(extra.numbers[3], -0));
  assert.ok("missing" in extra && extra.missing === undefined);
  assert.deepEqual(extra.tagLike, { $jm: "ref", v: 0 });
});

test("unsaveable values fail the save and keep the last good snapshot", () => {
  const storage = memory();
  const s = started();
  play(s, 3);
  assert.equal(saveRun(s, "run-c", storage), true);
  const good = storage.data.get(RUN_SAVE_KEY);
  for (const bad of [() => 1, new Date(), Symbol("x"), 1n]) {
    Object.assign(s, { bad });
    assert.equal(saveRun(s, "run-c", storage), false);
    assert.equal(storage.data.get(RUN_SAVE_KEY), good);
  }
});

test("corrupt, incompatible and finished snapshots are discarded", () => {
  const s = started();
  play(s, 3);
  const text = serializeRun(s, "run-d");
  const data = JSON.parse(text);
  const variant = (patch: object) => JSON.stringify({ ...data, ...patch });
  const finished = (phase: State["phase"]) =>
    serializeRun({ ...s, phase }, "run-d");
  for (const [name, bad] of [
    ["not JSON", "{"],
    ["truncated", text.slice(0, text.length / 2)],
    ["empty object", "{}"],
    ["old version", variant({ version: RUN_SAVE_VERSION + 1 })],
    ["other game build", variant({ shape: "0" })],
    ["missing run id", variant({ runId: "" })],
    ["long run id", variant({ runId: "x".repeat(129) })],
    ["no state", variant({ state: null })],
    ["array state", variant({ state: [] })],
    ["unknown tag", variant({ state: { ...data.state, time: { $jm: "?" } } })],
    ["dangling reference", variant({ state: { ...data.state, player: { $jm: "ref", v: 1e6 } } })],
    ["corrupt time", variant({ state: { ...data.state, time: "soon" } })],
    ["unknown robot", variant({ state: { ...data.state, config: { ...data.state.config, robotId: "nope" } } })],
    ["lost", finished("lost")],
    ["won", finished("won")],
    ["not started", finished("ready")],
  ] as const) {
    assert.equal(parseRun(bad), null, name);
    const storage = memory();
    storage.setItem(RUN_SAVE_KEY, bad);
    assert.equal(loadRun(storage), null, name);
    assert.equal(storage.data.has(RUN_SAVE_KEY), false, `${name} is removed`);
  }
  assert.equal(isResumable({ ...s, hp: 0 }), false);
  assert.equal(isResumable({ ...s, time: 0 }), false);
  assert.match(stateShape(), /^[0-9a-f]+$/);
});

test("saving refuses finished runs and storage round-trips by key", () => {
  const storage = memory();
  const s = started();
  assert.equal(saveRun(s, "run-e", storage), false, "nothing to resume at 0:00");
  play(s, 2);
  assert.equal(saveRun(s, "run-e", storage), true);
  assert.deepEqual(loadRun(storage)?.state, s);
  s.phase = "lost";
  assert.equal(saveRun(s, "run-e", storage), false);
  clearRun(storage);
  assert.equal(loadRun(storage), null);
  assert.equal(loadRun(memory()), null);
});

test("denied or full storage never throws", () => {
  const denied = {
    getItem: () => {
      throw Error("SecurityError");
    },
    setItem: () => {
      throw Error("QuotaExceededError");
    },
    removeItem: () => {
      throw Error("SecurityError");
    },
  };
  const s = started();
  play(s, 2);
  assert.equal(saveRun(s, "run-f", denied), false);
  assert.equal(loadRun(denied), null);
  assert.doesNotThrow(() => clearRun(denied));
});

test("a crowded late-game snapshot stays small and fast", (t) => {
  const s = started();
  play(s, 40);
  // Fill every bounded pool to its cap: an upper bound on real late-game saves.
  const e = s.enemies[0];
  s.time = 14 * 60;
  s.enemies = Array.from({ length: ENTITY_LIMITS.enemies }, (_, i) => ({
    ...e, id: 10_000 + i, x: e.x + i * 0.731, z: e.z - i * 0.377, hp: 17.28 + i / 7,
    hit: i % 3 ? 0 : 0.113, seed: (i * 7.31) % 10, slowUntil: s.time + 0.5, elite: i % 9 === 0,
  }));
  s.pickups = Array.from({ length: ENTITY_LIMITS.pickups }, (_, i) => ({
    id: 20_000 + i, x: i * 0.913 - 140.2, z: 88.71 - i * 0.417,
    kind: i % 2 ? "scrap" : "xp", born: s.time - i / 3, value: 1 + (i % 4),
  }));
  s.shots = Array.from({ length: ENTITY_LIMITS.shots }, (_, i) => ({
    id: 30_000 + i, x: i * 0.123 + 4.9, z: -i * 0.321 - 2.2, vx: 16.73, vz: -4.52,
    life: 1.37 - i / 200, kind: i % 3, damage: 9.5, pierce: 2, hitIds: [10_001, 10_002],
  }));
  s.turrets = Array.from({ length: ENTITY_LIMITS.turrets }, (_, i) => ({
    id: 40_000 + i, x: i * 1.9, z: -i * 1.3, life: 11.5 - i, fireTimer: 0.21, rank: 5,
  }));
  s.events = Array.from({ length: ENTITY_LIMITS.events }, (_, i) => ({
    kind: "hit" as const, x: i * 0.71, z: i * -0.37, fromX: 1.25, fromZ: -3.5,
  }));
  s.encounters.brains = new Map(
    s.enemies.map((enemy) => [enemy.id, { cooldown: 1.73, warning: 3, dash: 0.42, dx: 0.6, dz: -0.8 }] as const),
  );
  s.encounters.warnings = Array.from({ length: ENCOUNTER_LIMITS.warnings }, (_, i) => ({
    id: i, owner: 10_000 + i, kind: "zone" as const, x: i * 1.1, z: -i * 0.9, dx: 0.6,
    dz: 0.8, radius: 2.5, length: 6, remaining: 0.73, duration: 1.2,
  }));
  s.encounters.projectiles = Array.from({ length: ENCOUNTER_LIMITS.projectiles }, (_, i) => ({
    x: i * 0.37, z: i * 0.53, vx: 7.1, vz: -3.3, life: 2.4, damage: 14,
  }));
  s.encounters.zones = Array.from({ length: ENCOUNTER_LIMITS.zones }, (_, i) => ({
    x: i * 2.3, z: -i * 1.7, radius: 2.2, life: 3.9, damage: 11,
  }));
  s.discovery.consumed = new Map(
    Array.from({ length: DISCOVERY_LIMITS.sectors }, (_, i) => [i * 3, 7] as const),
  );
  s.discovery.salvageProgress = new Map(
    Array.from({ length: DISCOVERY_LIMITS.sectors }, (_, i) => [i * 5, 0.417] as const),
  );
  let text = "";
  const start = performance.now();
  for (let i = 0; i < 10; i++) text = serializeRun(s, crypto.randomUUID());
  const saveMs = (performance.now() - start) / 10;
  const loadStart = performance.now();
  for (let i = 0; i < 10; i++) assert.ok(parseRun(text));
  const loadMs = (performance.now() - loadStart) / 10;
  const kb = new TextEncoder().encode(text).length / 1024;
  t.diagnostic(`snapshot ${kb.toFixed(1)} KB, save ${saveMs.toFixed(2)} ms, restore ${loadMs.toFixed(2)} ms`);
  assert.ok(kb < 300, `${kb} KB`);
  // Generous: catches a pathological slowdown without timing flakiness.
  assert.ok(saveMs < 50 && loadMs < 50);
  assert.deepEqual(parseRun(text)!.state, s);
});

test("a restored run resumes analytics without a second start or repeated milestones", () => {
  const events: { event: string; properties: Record<string, unknown> }[] = [];
  const analytics = createRunAnalytics((event, properties) => events.push({ event, properties }));
  const s = started();
  s.time = 75;
  analytics.resume("saved", s, { away_seconds: 40 });
  analytics.resume("saved", s);
  analytics.observe(s);
  s.time = 181;
  s.upgrades.burst = 1;
  analytics.observe(s);
  analytics.abandon(s, "restart");
  assert.deepEqual(
    events.map((e) => e.event),
    ["run_resumed", "survival_milestone", "upgrade_selected", "run_abandoned"],
  );
  assert.equal(events[0].properties.run_id, "saved");
  assert.equal(events[0].properties.mode, "solo");
  assert.equal(events[0].properties.duration_seconds, 75);
  assert.equal(events[0].properties.away_seconds, 40);
  assert.equal(events[1].properties.milestone_seconds, 180);
});
