import test from "node:test";
import assert from "node:assert/strict";
import { createState, UPGRADES, type UpgradeId } from "./simulation";
import {
  resolveLanguage,
  setLanguage,
  t,
  upgradeName,
  localizedUpgradeDescription,
} from "./i18n";

test("saved language wins over browser preference, with safe fallback", () => {
  assert.equal(resolveLanguage(null, "tr-TR"), "tr");
  assert.equal(resolveLanguage("en", "tr-TR"), "en");
  assert.equal(resolveLanguage("tr", "en-US"), "tr");
  assert.equal(resolveLanguage("bad", "de-DE"), "en");
});

test("Turkish dynamic values and every upgrade translate without changing the run", () => {
  const state = createState();
  state.hp = 50;
  const before = structuredClone(state);
  setLanguage("tr");
  assert.equal(t("PRESSURE {wave}", { wave: 4 }), "TEHDİT 4");
  assert.equal(t("{xp} / {needed} XP", { xp: 3, needed: 9 }), "3 / 9 DP");
  for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
    assert.notEqual(upgradeName(id), UPGRADES[id].name);
    const tr = localizedUpgradeDescription(state, id);
    assert.ok(tr.length > 10);
    assert.equal(tr.includes("undefined"), false);
  }
  assert.match(localizedUpgradeDescription(state, "magnet"), /3,2 → 4,1/);
  assert.match(localizedUpgradeDescription(state, "repair"), /50 → 85/);
  assert.deepEqual(state, before);
  setLanguage("en");
  assert.equal(upgradeName("lightning"), "Chain Lightning");
  assert.equal(t("PRESSURE {wave}", { wave: 4 }), "PRESSURE 4");
});
