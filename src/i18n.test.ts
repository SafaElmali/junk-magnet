import test from "node:test";
import assert from "node:assert/strict";
import { createState, UPGRADES, type UpgradeId } from "./simulation";
import {
  resolveLanguage,
  LANGUAGES,
  languageFlag,
  translationCatalogs,
  setLanguage,
  t,
  upgradeName,
  localizedUpgradeDescription,
} from "./i18n";

test("saved language wins over browser preference, with safe fallback", () => {
  assert.equal(resolveLanguage(null, "tr-TR"), "tr");
  assert.equal(resolveLanguage("en", "tr-TR"), "en");
  assert.equal(resolveLanguage("tr", "en-US"), "tr");
  assert.equal(resolveLanguage("bad", "de-DE"), "de");
});

test("device preferences choose the first supported language in order", () => {
  assert.equal(resolveLanguage(null, ["tr-TR", "en-US"]), "tr");
  assert.equal(resolveLanguage(null, ["ja-JP", "pt-BR", "de-DE"]), "pt");
  assert.equal(resolveLanguage(null, ["en-US", "tr-TR"]), "en");
  assert.equal(resolveLanguage(null, ["FR_ca", "es-MX"]), "fr");
  assert.equal(resolveLanguage("de", ["tr-TR", "en-US"]), "de");
  assert.equal(resolveLanguage("invalid", ["ja-JP", "es-MX"]), "es");
  assert.equal(resolveLanguage(null, ["ja-JP", "ko-KR"]), "en");
  assert.equal(resolveLanguage(null, []), "en");
  assert.equal(resolveLanguage(null), "en");
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

test("six language preferences resolve locale prefixes and render SVG flags", () => {
  for (const { code, name } of LANGUAGES) {
    assert.ok(name.length > 1);
    assert.equal(resolveLanguage(null, `${code}-XX`), code);
    assert.equal(resolveLanguage(`${code.toUpperCase()}_XX`, "en"), code);
    assert.match(languageFlag(code), /<svg.*aria-hidden="true"/);
    assert.equal(/\p{Extended_Pictographic}/u.test(languageFlag(code)), false);
  }
  assert.equal(resolveLanguage("invalid", "ja-JP"), "en");
  assert.equal(resolveLanguage("es-MX", "pt-BR"), "es");
});

test("every locale covers the complete source catalog and preserves placeholders", () => {
  const sources = Object.keys(translationCatalogs.tr).sort();
  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [code, catalog] of Object.entries(translationCatalogs)) {
    assert.deepEqual(
      Object.keys(catalog).sort(),
      sources,
      `${code} source coverage`,
    );
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), `${code}: ${key}`);
      assert.deepEqual(
        placeholders(value),
        placeholders(key),
        `${code}: ${key}`,
      );
    }
  }
});

test("all languages translate ability names and real rank values without modifying the run", () => {
  const state = createState();
  state.hp = 50;
  for (const { code } of LANGUAGES) {
    setLanguage(code);
    for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
      if (code !== "en")
        assert.notEqual(upgradeName(id), UPGRADES[id].name, `${code}: ${id}`);
      for (const rank of [0, 1, 3]) {
        state.upgrades[id] = rank;
        const before = structuredClone(state);
        const description = localizedUpgradeDescription(state, id);
        assert.ok(description.length > 10);
        assert.doesNotMatch(description, /undefined|\{\w+\}/);
        assert.deepEqual(state, before);
      }
    }
    assert.match(localizedUpgradeDescription(state, "repair"), /50 → 85/);
    assert.ok(
      t("Level {level} · Choose one upgrade.", { level: 7 }).includes("7"),
    );
  }
  setLanguage("en");
});
