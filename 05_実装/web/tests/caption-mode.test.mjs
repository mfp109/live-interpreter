import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("caption authorization is Japanese-only and disables terminology mode", async () => {
  const authorization = await readFile(
    new URL("api/interpreter/authorize.php", root),
    "utf8",
  );
  assert.match(authorization, /\$mode === 'caption'/);
  assert.match(authorization, /\$source = 'ja'/);
  assert.match(authorization, /\$target = 'ja'/);
  assert.match(authorization, /\$mode === 'interpretation' &&/);
  assert.match(authorization, /'mode'=>\$mode/);
});

test("caption sessions consume one credit per second", async () => {
  const settlement = await readFile(
    new URL("api/interpreter/settle.php", root),
    "utf8",
  );
  assert.match(
    settlement,
    /source_language'\] === 'ja' && \$session\['target_language'\] === 'ja' \? 1 : 12/,
  );
  assert.match(settlement, /'credits_per_second'=>\$creditsPerSecond/);
});

test("caption UI requests caption mode and renders live transcript events", async () => {
  const interpreter = await readFile(
    new URL("src/Interpreter.tsx", root),
    "utf8",
  );
  assert.match(
    interpreter,
    /type InterpreterMode = "interpretation" \| "caption"/,
  );
  assert.match(interpreter, /data\.type === "caption_delta"/);
  assert.match(interpreter, /data\.type === "caption_completed"/);
  assert.match(interpreter, /mode === "caption" \? 1 : 12/);
  assert.match(interpreter, /className="caption-screen"/);
});
