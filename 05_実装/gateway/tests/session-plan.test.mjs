import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionPlan, translationCaptionDelta } from "../src/session-plan.mjs";

test("builds a combined audio and two-caption session plan", () => {
  assert.deepEqual(
    buildSessionPlan({
      src: "ja",
      mode: "both",
      audio_target: "en",
      captions: ["source", "zh"],
      translation_targets: ["en", "zh"],
      transcribe_source: true,
      rate: 25,
    }),
    {
      source: "ja",
      mode: "both",
      audioTarget: "en",
      captions: ["source", "zh"],
      translationTargets: ["en", "zh"],
      transcribeSource: true,
      rate: 25,
    },
  );
});

test("rejects a client rate that does not match the requested sessions", () => {
  assert.throws(() =>
    buildSessionPlan({
      src: "ja",
      mode: "captions",
      captions: ["source"],
      translation_targets: [],
      transcribe_source: true,
      rate: 12,
    }),
  );
});

test("maps translation transcript deltas", () => {
  assert.equal(
    translationCaptionDelta({
      type: "session.output_transcript.delta",
      delta: "Hello",
    }),
    "Hello",
  );
});
