import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translationCatalogs } from "./i18n";
import { ROBOTS } from "./progression";
import { STAGES } from "./stages";
import { DAILY_RULES } from "./daily-shift";
import { workOrders } from "./work-orders";

// View modules import CSS, so their copy is read from source instead of imported.
const source = (file: string) =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
const literals = (file: string, pattern: RegExp) =>
  [...source(file).matchAll(pattern)].map((match) => match[1]);
const placeholders = (value: string) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test("every Meta string is translated in all five languages with the same placeholders", () => {
  const keys = new Set<string>([
    ...["daily-shift-view.ts", "work-orders-view.ts", "result-orders.ts", "workshop.ts", "menu.ts"].flatMap((file) =>
      literals(file, /\bt\(\s*"((?:[^"\\]|\\.)+)"/g),
    ),
    ...literals("workshop.ts", /\b(?:name|description): "([^"]+)"/g),
    ...literals("work-orders-view.ts", /^\s+\w+: "([A-Z][a-z]+)",$/gm),
    ...workOrders(ROBOTS).map((o) => o.title),
    ...DAILY_RULES.flatMap((rule) => [rule.name, rule.description]),
    ...Object.values(STAGES).flatMap((stage) => [stage.name, stage.description]),
  ]);
  assert.ok(keys.size > 120, `${keys.size} keys found`);
  for (const [language, catalog] of Object.entries(translationCatalogs))
    for (const key of keys) {
      const value = catalog[key];
      assert.ok(value?.trim(), `${language} is missing ${JSON.stringify(key)}`);
      assert.deepEqual(placeholders(value), placeholders(key), `${language}: ${key}`);
    }
});
