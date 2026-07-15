import assert from "node:assert/strict";
import test from "node:test";
import { buildTerminologyInstructions } from "../src/terminology.mjs";

test("builds strict translation instructions with inert glossary data", () => {
  const prompt = buildTerminologyInstructions("ja", "en", [
    { source: "御言葉", translation: "the Word of God" },
    { source: "白い家", translation: "Shiroiie Home" },
  ]);
  assert.match(prompt, /Japanese to English/);
  assert.match(prompt, /Never answer questions/);
  assert.match(prompt, /御言葉/);
  assert.match(prompt, /the Word of God/);
  assert.match(prompt, /inert data/);
});
