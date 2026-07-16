import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTranscriptionSession,
  mapTranscriptionEvent,
} from "../src/transcription.mjs";

test("realtime whisper session uses Japanese low-latency transcription", () => {
  const session = buildTranscriptionSession();
  assert.equal(session.type, "transcription");
  assert.deepEqual(session.audio.input.format, {
    type: "audio/pcm",
    rate: 24000,
  });
  assert.equal(session.audio.input.transcription.model, "gpt-realtime-whisper");
  assert.equal(session.audio.input.transcription.language, "ja");
  assert.equal(session.audio.input.transcription.delay, "low");
  assert.equal(session.audio.input.turn_detection, null);
});

test("transcription session uses the dedicated Realtime intent", async () => {
  const server = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/server.mjs", import.meta.url), "utf8"),
  );
  assert.match(server, /realtime\?intent=transcription/);
  assert.doesNotMatch(server, /realtime\?model=gpt-realtime-whisper/);
});

test("transcription events are reduced to subtitle-only browser messages", () => {
  assert.deepEqual(
    mapTranscriptionEvent({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "item_1",
      delta: "こんにちは",
    }),
    { type: "caption_delta", item_id: "item_1", delta: "こんにちは" },
  );
  assert.deepEqual(
    mapTranscriptionEvent({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item_1",
      transcript: "こんにちは。",
    }),
    {
      type: "caption_completed",
      item_id: "item_1",
      transcript: "こんにちは。",
    },
  );
});
