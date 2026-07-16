export function isCaptionMode(claims) {
  return (
    claims?.mode === "caption" && claims?.src === "ja" && claims?.dst === "ja"
  );
}

export function buildTranscriptionSession(language = "ja") {
  return {
    type: "transcription",
    audio: {
      input: {
        format: { type: "audio/pcm", rate: 24000 },
        transcription: {
          model: "gpt-realtime-whisper",
          language,
          delay: "low",
        },
        turn_detection: null,
      },
    },
  };
}

export function mapTranscriptionEvent(event) {
  if (event?.type === "conversation.item.input_audio_transcription.delta") {
    return {
      type: "caption_delta",
      item_id: String(event.item_id || ""),
      delta: String(event.delta || ""),
    };
  }
  if (event?.type === "conversation.item.input_audio_transcription.completed") {
    return {
      type: "caption_completed",
      item_id: String(event.item_id || ""),
      transcript: String(event.transcript || ""),
    };
  }
  return null;
}
