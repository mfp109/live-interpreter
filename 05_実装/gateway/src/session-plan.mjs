const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

export function buildSessionPlan(claims) {
  const source = String(claims?.src || "");
  const mode = String(claims?.mode || "");
  const audioTarget = claims?.audio_target
    ? String(claims.audio_target)
    : null;
  const captions = Array.isArray(claims?.captions)
    ? claims.captions.map(String).slice(0, 2)
    : [];
  const translationTargets = Array.isArray(claims?.translation_targets)
    ? [...new Set(claims.translation_targets.map(String))]
    : [];
  const transcribeSource = claims?.transcribe_source === true;
  const rate = Number(claims?.rate);

  if (!LANGUAGE_PATTERN.test(source)) throw new Error("plan_invalid");
  if (!["audio", "both", "captions"].includes(mode))
    throw new Error("plan_invalid");
  if (audioTarget && !LANGUAGE_PATTERN.test(audioTarget))
    throw new Error("plan_invalid");
  if (translationTargets.some((language) => !LANGUAGE_PATTERN.test(language)))
    throw new Error("plan_invalid");
  if (captions.some((language) => language !== "source" && !LANGUAGE_PATTERN.test(language)))
    throw new Error("plan_invalid");
  if ((mode === "audio" || mode === "both") && !audioTarget)
    throw new Error("plan_invalid");
  if ((mode === "both" || mode === "captions") && captions.length === 0)
    throw new Error("plan_invalid");
  if (audioTarget && !translationTargets.includes(audioTarget))
    throw new Error("plan_invalid");

  const calculatedRate = translationTargets.length * 12 + (transcribeSource ? 1 : 0);
  if (!Number.isInteger(rate) || rate !== calculatedRate || rate < 1 || rate > 37)
    throw new Error("plan_invalid");

  return {
    source,
    mode,
    audioTarget,
    captions,
    translationTargets,
    transcribeSource,
    rate,
  };
}

export function translationCaptionDelta(event) {
  if (
    event?.type === "session.output_transcript.delta" ||
    event?.type === "response.output_audio_transcript.delta" ||
    event?.type === "response.audio_transcript.delta"
  ) {
    return String(event.delta || "");
  }
  return "";
}
