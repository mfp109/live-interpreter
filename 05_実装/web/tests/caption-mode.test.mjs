import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("authorization supports audio, combined, and two-caption modes", async () => {
  const authorization = await readFile(new URL("api/interpreter/authorize.php", root), "utf8");
  assert.match(authorization, /\['audio','both','captions'\]/);
  assert.match(authorization, /count\(\$rawCaptions\) > 2/);
  assert.match(authorization, /count\(\$translationTargets\) \* 12/);
  assert.match(authorization, /\$transcribeSource \? 1 : 0/);
  assert.doesNotMatch(authorization, /glossary|terminology/i);
});

test("trusted gateway supplies the configured per-second credit rate", async () => {
  const settlement = await readFile(new URL("api/interpreter/settle.php", root), "utf8");
  assert.match(settlement, /credits_per_second/);
  assert.match(settlement, /\$creditsPerSecond > 37/);
  assert.match(settlement, /\$requestedCredits=\$seconds\*\$creditsPerSecond/);
});

test("web UI exposes Mac-equivalent output modes and two caption lanes", async () => {
  const interpreter = await readFile(new URL("src/Interpreter.tsx", root), "utf8");
  assert.match(interpreter, /type Mode = "both" \| "audio" \| "captions"/);
  assert.match(interpreter, /caption_languages: captionLanguages/);
  assert.match(interpreter, /className="dual-caption-screen"/);
  assert.match(interpreter, /caption1/);
  assert.match(interpreter, /caption2/);
  assert.doesNotMatch(interpreter, /glossary|terminology/i);
});

test("web site offers the same 13 display languages as the Mac app", async () => {
  const locales = await readFile(new URL("src/locales.ts", root), "utf8");
  for (const code of ["ja","en","zh-CN","es","pt","fr","de","ru","ko","hi","id","vi","it"])
    assert.match(locales, new RegExp(`\\["${code}"`));
});
