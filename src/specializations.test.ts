import test from "node:test";
import assert from "node:assert/strict";
import { createState, chooseUpgrade, chooseSpecialization, offerUpgrade, launch, orbitPosition, update, type State, type Enemy } from "./simulation";
import { DEFAULT_RUN_CONFIG } from "./progression";
import { upgradeChoicesMarkup } from "./level-up";
import { setLanguage } from "./i18n";
import { specializationCopy } from "./specialization-ui";
const still = { x: 0, z: 0 };
function playing(): State {
  const s = createState({ ...DEFAULT_RUN_CONFIG, damageMultiplier: 1 });
  s.phase = "playing";
  s.enemies = [];
  s.pickups = [];
  s.spawnTimer = 100;
  s.pulseTimer = 100;
  s.cooldown = 100;
  s.openingRemaining = 0;
  return s;
}
function enemy(id: number, x: number, z = 0): Enemy { return { id, x, z, hp: 100, hit: 0, seed: 0, type: "can" }; }
function tick(s: State) { update(s, 0.01, still, { world: false, deferDiscovery: true }); }
test("rank three creates an exclusive branch choice without charging another level", () => {
  const s = playing();
  s.upgrades.lightning = 2;
  s.phase = "upgrade";
  s.choices = ["lightning"];
  const level = s.level;
  assert.equal(chooseUpgrade(s, "lightning"), true);
  assert.equal(s.phase, "upgrade");
  assert.deepEqual(s.specializationChoices, ["lightning_chain", "lightning_focus"]);
  assert.equal(s.level, level);
  assert.equal(chooseSpecialization(s, "saw_rail"), false);
  assert.equal(chooseUpgrade(s, "lightning"), false);
  assert.equal(chooseSpecialization(s, "lightning_focus"), true);
  assert.equal(s.specializations.lightning, "lightning_focus");
  assert.equal(s.phase, "playing");
  assert.equal(chooseSpecialization(s, "lightning_chain"), false);
  s.phase = "upgrade";
  s.choices = ["lightning"];
  chooseUpgrade(s, "lightning");
  assert.deepEqual(s.specializationChoices, []);
  assert.equal(s.specializations.lightning, "lightning_focus");
});
test("queued XP waits for specialization and continues after selection", () => {
  const s = playing();
  s.upgrades.saw = 2;
  s.phase = "upgrade";
  s.choices = ["saw"];
  s.xp = 100;
  chooseUpgrade(s, "saw");
  offerUpgrade(s);
  assert.equal(s.xp, 100);
  assert.equal(s.choices.length, 0);
  chooseSpecialization(s, "saw_rail");
  assert.ok(s.choices.length > 0);
  assert.equal(s.phase, "upgrade");
  assert.ok(s.xp < 100);
});
test("saw branches trade orbit damage and range for piercing launch damage", () => {
  const s = playing();
  s.upgrades.saw = 3;
  s.scrap = 1;
  const base = orbitPosition(s, 0);
  s.specializations.saw = "saw_reaper";
  assert.ok(Math.abs(orbitPosition(s, 0).x - base.x - 0.6) < 1e-9);
  s.cooldown = 0;
  assert.equal(launch(s), true);
  assert.equal(s.shots[0].damage, 5.25);
  s.specializations.saw = "saw_rail";
  s.scrap = 1;
  s.cooldown = 0;
  launch(s);
  assert.equal(s.shots[1].damage, 10.5);
  assert.equal(s.shots[1].pierce, 2);
});
test("focused lightning strikes only one enemy for triple damage; chain reaches seven", () => {
  const focus = playing();
  focus.upgrades.lightning = 3;
  focus.specializations.lightning = "lightning_focus";
  focus.enemies = [enemy(100, 4), enemy(101, 5)];
  tick(focus);
  assert.deepEqual(focus.enemies.map(e => e.hp), [76, 100]);
  const chain = playing();
  chain.upgrades.lightning = 3;
  chain.specializations.lightning = "lightning_chain";
  chain.enemies = Array.from({ length: 8 }, (_, i) => enemy(100 + i, 4 + i * 5));
  tick(chain);
  assert.deepEqual(chain.enemies.map(e => e.hp), [94, 94, 94, 94, 94, 94, 94, 100]);
});
test("turret branches alter range, fire cadence and projectile payload", () => {
  const rapid = playing();
  rapid.upgrades.turret = 3;
  rapid.specializations.turret = "turret_rapid";
  rapid.enemies = [enemy(100, 6)];
  tick(rapid);
  assert.equal(rapid.shots[0].damage, 3.5);
  assert.ok(Math.abs(rapid.turrets[0].fireTimer - 0.36) < 1e-9);
  const sniper = playing();
  sniper.upgrades.turret = 3;
  sniper.specializations.turret = "turret_sniper";
  sniper.enemies = [enemy(100, 12)];
  tick(sniper);
  assert.equal(sniper.shots[0].damage, 10);
  assert.equal(sniper.shots[0].pierce, 1);
  assert.ok(Math.abs(sniper.turrets[0].fireTimer - 0.96) < 1e-9);
});
test("burst wave controls a larger area while crusher concentrates damage", () => {
  const wave = playing();
  wave.upgrades.burst = 3;
  wave.specializations.burst = "burst_wave";
  wave.enemies = [enemy(100, 5)];
  tick(wave);
  assert.equal(wave.enemies[0].hp, 94);
  assert.equal(wave.enemies[0].x, 8);
  const crush = playing();
  crush.upgrades.burst = 3;
  crush.specializations.burst = "burst_crush";
  crush.enemies = [enemy(100, 2), enemy(101, 3.5)];
  tick(crush);
  assert.ok(Math.abs(crush.enemies[0].hp - 82.4) < 1e-9);
  assert.equal(crush.enemies[1].hp, 100);
});
test("specialization choice markup and copy cover every supported language", () => {
  const s = playing();
  s.specializationChoices = ["saw_reaper", "saw_rail"];
  for (const language of ["en", "tr", "de", "fr", "es", "pt"] as const) {
    setLanguage(language);
    const markup = upgradeChoicesMarkup(s);
    assert.match(markup, /data-specialization="saw_reaper" data-choice="0"/);
    assert.match(markup, /data-specialization="saw_rail" data-choice="1"/);
    assert.ok(markup.includes(specializationCopy("saw_reaper")[0]));
  }
  setLanguage("en");
});
