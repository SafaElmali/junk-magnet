import test from "node:test";
import assert from "node:assert/strict";
import { AudioCues, eventCue, GameAudio } from "./audio";
import { createState, update, chooseUpgrade } from "./simulation";

test("audio follows real upgrades once, including co-op snapshot replacements", () => {
  const cues = new AudioCues(),
    s = createState();
  cues.update(s);
  s.phase = "playing";
  s.xp = s.xpNeeded;
  update(s, 0.02, { x: 0, z: 0 });
  assert.deepEqual(cues.update(s), ["level"]);
  assert.deepEqual(cues.update(structuredClone(s)), []);
  assert.ok(chooseUpgrade(s, s.choices[0]));
  assert.deepEqual(cues.update(s), ["upgrade"]);
  assert.deepEqual(cues.update(structuredClone(s)), []);
  s.phase = "lost";
  assert.deepEqual(cues.update(s), ["defeat"]);
  assert.deepEqual(cues.update(s), []);
  assert.deepEqual(
    cues.update(createState()),
    [],
    "new run resets the audio counters",
  );
});

test("boss, repair and evolution cues survive deserialization without repeated rewards", () => {
  const cues = new AudioCues(),
    s = createState();
  cues.update(s);
  s.encounters.active = { id: 101, type: "boss", maxHp: 100 };
  assert.deepEqual(cues.update(s), ["boss"]);
  s.encounters.active = null;
  s.encounters.defeated++;
  assert.deepEqual(cues.update(s), ["reward"]);
  s.discovery.lastReward = {
    kind: "repair",
    until: 5,
    xp: 0,
    scrap: 0,
    hp: 40,
    parts: 0,
  };
  assert.deepEqual(cues.update(s), ["repair"]);
  s.evolutions.vortex = true;
  s.upgrades.saw++;
  assert.deepEqual(
    cues.update(s),
    ["evolve"],
    "evolution takes precedence over ordinary upgrade",
  );
  assert.deepEqual(cues.update(structuredClone(s)), []);
});

test("real scrap and XP collections emit different sounds and turret shots emit a cue", () => {
  const s = createState();
  s.phase = "playing";
  s.time = 10;
  s.openingRemaining = 0;
  s.spawnTimer = 999;
  s.pickups = [
    { id: 101, x: 0, z: 0, kind: "scrap", born: 0 },
    { id: 102, x: 0, z: 0, kind: "xp", born: 0 },
  ];
  update(s, 0.02, { x: 0, z: 0 });
  assert.deepEqual(s.events.filter((e) => e.kind === "collect").map(eventCue), [
    "scrap",
    "xp",
  ]);
  s.upgrades.turret = 1;
  s.enemies.push({
    id: 103,
    x: 4,
    z: 0,
    hp: 100,
    hit: 0,
    seed: 0,
    type: "can",
  });
  s.events = [];
  update(s, 0.02, { x: 0, z: 0 });
  assert.ok(s.events.some((e) => eventCue(e) === "turret"));
});

test("audio degrades safely without storage or browser audio support", async () => {
  const audio = new GameAudio();
  assert.equal(audio.enabled, true);
  assert.equal(audio.musicEnabled, true);
  await assert.doesNotReject(audio.toggle());
  assert.equal(audio.enabled, false);
  assert.equal(audio.musicEnabled, true);
  audio.toggleMusic();
  assert.equal(audio.musicEnabled, false);
  await assert.doesNotReject(audio.toggle());
  assert.equal(audio.enabled, true);
  assert.equal(audio.musicEnabled, false);
  assert.doesNotThrow(() => audio.play("hurt"));
});

test("volume controls clamp independently and preserve mute preferences", () => {
  const audio = new GameAudio();
  assert.equal(audio.effectsVolume, 50);
  assert.equal(audio.musicVolume, 50);
  audio.setVolume("sound", 150);
  assert.equal(audio.effectsVolume, 100);
  assert.equal(audio.musicVolume, 50);
  audio.setVolume("music", -10);
  assert.equal(audio.musicVolume, 0);
  assert.equal(audio.enabled, true);
  assert.equal(audio.musicEnabled, true);
  audio.setVolume("sound", NaN);
  assert.equal(audio.effectsVolume, 100);
});
