import crypto from "node:crypto";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "terms", "risks", "speaking_tips", "checklist"],
  properties: {
    summary: { type: "string" },
    terms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "translation", "note"],
        properties: {
          source: { type: "string" },
          translation: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    speaking_tips: { type: "array", items: { type: "string" } },
    checklist: { type: "array", items: { type: "string" } },
  },
};

export function buildPreparationRequest(input) {
  const outputLanguage = { ja: "Japanese", en: "English", "zh-CN": "Simplified Chinese" }[input.locale] || "Japanese";
  return {
    model: "gpt-5.6",
    store: false,
    reasoning: { effort: "low" },
    safety_identifier: crypto.createHash("sha256").update(String(input.user_id)).digest("hex"),
    instructions: [
      "Create a practical preparation brief for a live spoken interpretation session.",
      `Write all explanations in ${outputLanguage}.`,
      "Do not claim this brief changes or customizes the realtime translation model.",
      "Focus on names, numbers, abbreviations, specialized terms, and short speaking techniques that reduce interpretation mistakes.",
      "If an optional field is empty, work only from the available context. Never invent personal or confidential facts.",
    ].join(" "),
    input: [
      `Source language: ${input.source_language}`,
      `Target language: ${input.target_language}`,
      `Situation: ${input.situation}`,
      `Purpose: ${input.purpose || "(not provided)"}`,
      `Key terms: ${input.key_terms || "(not provided)"}`,
    ].join("\n"),
    text: {
      format: {
        type: "json_schema",
        name: "interpretation_preparation_brief",
        strict: true,
        schema,
      },
    },
  };
}

export function extractPreparationBrief(response) {
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "refusal") throw new Error("model_refused");
      if (content?.type === "output_text" && typeof content.text === "string") {
        const value = JSON.parse(content.text);
        if (!value || typeof value.summary !== "string" || !Array.isArray(value.terms) || !Array.isArray(value.risks) || !Array.isArray(value.speaking_tips) || !Array.isArray(value.checklist)) {
          throw new Error("invalid_model_output");
        }
        return value;
      }
    }
  }
  throw new Error("missing_model_output");
}

export async function generatePreparationBrief(input, apiKey, fetchImpl = fetch) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildPreparationRequest(input)),
    signal: AbortSignal.timeout(40000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`openai_${response.status}`);
  return extractPreparationBrief(data);
}
