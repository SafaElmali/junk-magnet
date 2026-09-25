import test from "node:test";
import assert from "node:assert/strict";
import { AudioCues, eventCue, GameAudio, masterLevel } from "./audio";
import { usePlatformStorage } from "./storage";
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

test("hidden tabs, the platform mute and a playing ad each silence the game", () => {
  const none = { hidden: false, platformMuted: false, adMuted: false };
  assert.equal(masterLevel(none), 0.75);
  for (const key of ["hidden", "platformMuted", "adMuted"] as const)
    assert.equal(masterLevel({ ...none, [key]: true }), 0, key);
  assert.equal(masterLevel({ hidden: false, platformMuted: true, adMuted: true }), 0);
});

test("an ad mute lifts back to the platform mute and never changes the player's settings", async () => {
  const saved = new Map<string, string>();
  usePlatformStorage({
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => void saved.set(key, value),
  });
  const audio = new GameAudio();
  await audio.toggle(); // The player's own choice: sound effects off.
  audio.setVolume("music", 30);
  const preferences = saved.get("junk-magnet-audio-v2");
  audio.setPlatformMuted(true);
  audio.setAdMuted(true);
  assert.equal(audio.diagnostics().level, 0);
  audio.setAdMuted(false);
  assert.equal(audio.diagnostics().adMuted, false);
  assert.equal(audio.diagnostics().level, 0, "CrazyGames still mutes the game");
  audio.setPlatformMuted(false);
  assert.equal(audio.diagnostics().level, 0.75);
  audio.setAdMuted(true);
  assert.equal(audio.diagnostics().level, 0);
  audio.setAdMuted(false);
  assert.equal(audio.diagnostics().level, 0.75);
  assert.equal(audio.enabled, false, "the player's mute survives the ad");
  assert.equal(audio.musicEnabled, true);
  assert.equal(audio.musicVolume, 30);
  assert.equal(saved.get("junk-magnet-audio-v2"), preferences, "ad mutes are never saved");
});
