import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LANGUAGES } from "../languages";
import { landingCopy } from "./landing-locales";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const placeholders = (value: string) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test("every landing string has copy in all six languages with its placeholders", () => {
  for (const [source, copy] of landingCopy) {
    assert.equal(copy.en, source);
    for (const { code } of LANGUAGES) {
      assert.ok(copy[code]?.trim(), `${code}: ${source}`);
      assert.deepEqual(placeholders(copy[code]), placeholders(source));
    }
  }
});

test("landing copy still matches index.html, so no string silently stays English", () => {
  // Templates are filled in by landing.ts; every other key is page text or a label.
  for (const source of landingCopy.keys())
    if (!placeholders(source).length)
      assert.ok(
        html.includes(source),
        `index.html no longer contains: ${source}`,
      );
});
