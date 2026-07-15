import assert from "node:assert/strict";
import test from "node:test";
import { buildTerminologyInstructions, shouldUseTerminologyMode } from "../src/terminology.mjs";

test("uses the general Realtime model only after explicit terminology opt-in", () => {
  const glossary = [{ source: "御言葉", translation: "the Word of God" }];
  assert.equal(shouldUseTerminologyMode({ glossary }), false);
  assert.equal(shouldUseTerminologyMode({ terminology_mode: false, glossary }), false);
  assert.equal(shouldUseTerminologyMode({ terminology_mode: true, glossary: [] }), false);
  assert.equal(shouldUseTerminologyMode({ terminology_mode: true, glossary }), true);
});

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
