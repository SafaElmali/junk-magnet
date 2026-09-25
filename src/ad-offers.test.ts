import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AdOffers, adRevivesUsed } from "./ad-offers";
import { translationCatalogs } from "./i18n";
import { createProgression, DEFAULT_RUN_CONFIG } from "./progression";
import { createState, revive, REVIVE_HEALTH } from "./simulation";

const solo = { solo: true, available: true };
/** A run that has just been lost: lethal damage without a revive left. */
const lostRun = (revives = 0) => {
  const s = createState({ ...DEFAULT_RUN_CONFIG, revives });
  s.time = 95;
  s.hp = 0;
  s.phase = "lost";
  return s;
};

test("a lost solo run gets one revive offer, and only while ads are available", () => {
  const offers = new AdOffers();
  const s = lostRun();
  assert.equal(offers.offerRevive("a", s, { solo: true, available: false }), false);
  assert.equal(offers.offerRevive("a", s, { solo: false, available: true }), false);
  assert.equal(offers.offerRevive("a", s, solo), true, "the first defeat with ads");
  assert.equal(offers.offerRevive("a", s, solo), false, "never twice for one run id");
  assert.equal(offers.offerRevive("b", lostRun(), solo), true, "the next run gets its own");
  const cleared = lostRun();
  cleared.phase = "won";
  assert.equal(offers.offerRevive("c", cleared, solo), false, "a stage clear goes to results");
  const playing = lostRun();
  playing.phase = "playing";
  assert.equal(offers.offerRevive("d", playing, solo), false);
});

test("a run revived by an ad goes straight to results, even after a reload", () => {
  const s = lostRun();
  assert.equal(new AdOffers().offerRevive("run", s, solo), true);
  assert.ok(revive(s, "external"));
  assert.equal(s.phase, "playing");
  assert.equal(s.hp, REVIVE_HEALTH);
  assert.equal(adRevivesUsed(s), 1);
  s.hp = 0;
  s.phase = "lost";
  // A restored run keeps its id but starts with fresh in-memory bookkeeping.
  const restored = structuredClone(s);
  assert.equal(new AdOffers().offerRevive("run", restored, solo), false);
});

test("automatic workshop revives do not count as the ad revive", () => {
  const s = createState({ ...DEFAULT_RUN_CONFIG, revives: 2 });
  s.phase = "playing";
  s.hp = 0;
  assert.ok(revive(s, "auto"));
  assert.equal(s.revives, 1);
  assert.equal(s.stats.revivesUsed, 1);
  assert.equal(adRevivesUsed(s), 0);
  const lost = lostRun();
  lost.stats.revivesUsed = 2;
  lost.config = { ...lost.config, revives: 2 };
  assert.equal(adRevivesUsed(lost), 0, "both workshop revives already spent");
  assert.equal(new AdOffers().offerRevive("x", lost, solo), true);
});

test("double parts is offered once per recorded run and survives re-renders", () => {
  const offers = new AdOffers();
  const receipt = { runId: "r1", earned: 24 };
  assert.equal(offers.doubleParts(null, solo), null);
  assert.equal(offers.doubleParts(receipt, { solo: false, available: true }), null);
  assert.equal(offers.doubleParts(receipt, { solo: true, available: false }), null);
  assert.equal(offers.doubleParts({ runId: "r0", earned: 0 }, solo), null, "nothing to double");
  assert.equal(offers.doubleParts(receipt, solo), "offer");
  offers.startDouble("r1");
  // requestRewardedAd reports ads unavailable while one is pending.
  assert.equal(offers.doubleParts(receipt, { solo: true, available: false }), "pending");
  offers.finishDouble("r1", 24);
  assert.equal(offers.doubleParts(receipt, solo), "granted");
  assert.equal(offers.bonus("r1"), 24);
  offers.startDouble("r1");
  offers.finishDouble("r1", 99);
  assert.equal(offers.bonus("r1"), 24, "a used offer never pays again");
  assert.equal(offers.doubleParts(receipt, { solo: true, available: false }), "granted");
  assert.equal(offers.doubleParts({ runId: "r2", earned: 5 }, solo), "offer");
});

test("a failed double-parts ad hides the offer for that run without a bonus", () => {
  const offers = new AdOffers();
  const receipt = { runId: "f", earned: 10 };
  offers.startDouble("f");
  offers.finishDouble("f", null);
  assert.equal(offers.doubleParts(receipt, solo), "failed");
  assert.equal(offers.bonus("f"), 0);
  offers.finishDouble("f", 10);
  assert.equal(offers.doubleParts(receipt, solo), "failed", "only a pending request settles");
});

test("doubling banks the run's earned parts once through progression", () => {
  const data = new Map<string, string>();
  const bank = createProgression({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  });
  const receipt = bank.recordRun({ runId: "run", phase: "lost", time: 120, kills: 40, earnedParts: 8 })!;
  const offers = new AdOffers();
  offers.startDouble(receipt.runId);
  offers.finishDouble(receipt.runId, bank.grantBonusParts(receipt.runId, receipt.earned));
  assert.equal(offers.bonus("run"), receipt.earned);
  assert.equal(bank.getProgress().parts, receipt.parts + receipt.earned);
  assert.equal(bank.grantBonusParts(receipt.runId, receipt.earned), 0);
});

test("every ad offer string is translated in all five languages with the same placeholders", () => {
  const source = readFileSync(new URL("./ad-offers-view.ts", import.meta.url), "utf8");
  const keys = [...source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)].map((m) => m[1]);
  // The reward line picks one of two strings in a ternary.
  keys.push("+{parts} parts (doubled) · Bank: {total}", "+{parts} parts · Bank: {total}");
  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  assert.equal(new Set(keys).size, 8, `keys found: ${keys}`);
  for (const [language, catalog] of Object.entries(translationCatalogs))
    for (const key of keys) {
      assert.ok(catalog[key]?.trim(), `${language} is missing ${JSON.stringify(key)}`);
      assert.deepEqual(placeholders(catalog[key]), placeholders(key), `${language}: ${key}`);
    }
});
