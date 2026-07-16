export function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function appendRollingText(current, delta, maxLength = 700) {
  const next = `${current || ""}${delta || ""}`;
  if (next.length <= maxLength) return next;
  return next.slice(next.length - maxLength).replace(/^\S*\s?/, "");
}

export function appendTranscriptText(current, delta) {
  return `${current || ""}${delta || ""}`;
}

export function splitTranscriptSentences(text) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  if (!normalized) return [];
  if (typeof Intl?.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("ja", { granularity: "sentence" });
    return [...segmenter.segment(normalized)].map(({ segment }) => segment.trim()).filter(Boolean);
  }
  return normalized.match(/.*?[。！？.!?]+(?:\s+|$)?|.+$/gs)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

export function captionDisplayText(text) {
  return splitTranscriptSentences(text).join("\n");
}

export function buildTranscriptExport({ language1Text = "", language2Text = "", scope = "both", layout = "interleaved" } = {}) {
  const first = String(language1Text || "").trim();
  const second = String(language2Text || "").trim();
  if (scope === "language1") return captionDisplayText(first);
  if (scope === "language2") return captionDisplayText(second);
  if (layout === "grouped") return [first, second].filter(Boolean).join("\n\n");
  const firstSentences = splitTranscriptSentences(first);
  const secondSentences = splitTranscriptSentences(second);
  const lines = [];
  for (let index = 0; index < Math.max(firstSentences.length, secondSentences.length); index += 1) {
    if (firstSentences[index]) lines.push(firstSentences[index]);
    if (secondSentences[index]) lines.push(secondSentences[index]);
  }
  return lines.join("\n");
}

export function extractClientSecret(payload) {
  if (typeof payload?.value === "string" && payload.value) return payload.value;
  if (typeof payload?.client_secret?.value === "string" && payload.client_secret.value) return payload.client_secret.value;
  return "";
}

export const OUTPUT_LANGUAGES = [
  ["es", "スペイン語", "Español"], ["pt", "ポルトガル語", "Português"], ["fr", "フランス語", "Français"],
  ["ja", "日本語", "日本語"], ["ru", "ロシア語", "Русский"], ["zh", "中国語", "中文"],
  ["de", "ドイツ語", "Deutsch"], ["ko", "韓国語", "한국어"], ["hi", "ヒンディー語", "हिन्दी"],
  ["id", "インドネシア語", "Bahasa Indonesia"], ["vi", "ベトナム語", "Tiếng Việt"], ["it", "イタリア語", "Italiano"],
  ["en", "英語", "English"],
].map(([code, label, nativeLabel]) => ({ code, label, nativeLabel }));

export const INPUT_LANGUAGES = [
  ["ar", "アラビア語"], ["af", "アフリカーンス語"], ["az", "アゼルバイジャン語"],
  ["be", "ベラルーシ語"], ["bn", "ベンガル語"], ["bs", "ボスニア語"],
  ["bg", "ブルガリア語"], ["ca", "カタルーニャ語"], ["zh", "中国語"],
  ["hr", "クロアチア語"], ["cs", "チェコ語"], ["da", "デンマーク語"],
  ["nl", "オランダ語"], ["dz", "ゾンカ語"], ["en", "英語"],
  ["eo", "エスペラント語"], ["et", "エストニア語"], ["eu", "バスク語"],
  ["fa", "ペルシャ語"], ["fi", "フィンランド語"], ["fil", "フィリピン語"],
  ["fr", "フランス語"], ["gl", "ガリシア語"], ["de", "ドイツ語"],
  ["el", "ギリシャ語"], ["gu", "グジャラート語"], ["ht", "ハイチ・クレオール語"],
  ["haw", "ハワイ語"], ["he", "ヘブライ語"], ["hi", "ヒンディー語"],
  ["hu", "ハンガリー語"], ["hy", "アルメニア語"], ["id", "インドネシア語"],
  ["it", "イタリア語"], ["ja", "日本語"], ["jv", "ジャワ語"],
  ["ka", "ジョージア語"], ["kk", "カザフ語"], ["ko", "韓国語"],
  ["ku", "クルド語"], ["la", "ラテン語"], ["lv", "ラトビア語"],
  ["lt", "リトアニア語"], ["mk", "マケドニア語"], ["ms", "マレー語"],
  ["ml", "マラヤーラム語"], ["mi", "マオリ語"], ["mn", "モンゴル語"],
  ["my", "ミャンマー語"], ["ne", "ネパール語"], ["no", "ノルウェー語"],
  ["nn", "ニーノシュク"], ["pl", "ポーランド語"], ["pt", "ポルトガル語"],
  ["pa", "パンジャブ語"], ["ro", "ルーマニア語"], ["ru", "ロシア語"],
  ["sr", "セルビア語"], ["sn", "ショナ語"], ["sk", "スロバキア語"],
  ["sl", "スロベニア語"], ["sq", "アルバニア語"], ["es", "スペイン語"],
  ["sw", "スワヒリ語"], ["sv", "スウェーデン語"], ["tl", "タガログ語"],
  ["te", "テルグ語"], ["th", "タイ語"], ["tr", "トルコ語"],
  ["uk", "ウクライナ語"], ["uz", "ウズベク語"], ["vi", "ベトナム語"],
  ["cy", "ウェールズ語"], ["yo", "ヨルバ語"],
].map(([code, label]) => ({ code, label }));

export const TRANSLATION_USD_PER_MINUTE = 0.034;
export const TRANSCRIPTION_USD_PER_MINUTE = 0.017;

export function isAllowedLanguage(value) {
  return OUTPUT_LANGUAGES.some(({ code }) => code === value);
}

export function estimateTranslationCost(seconds, sessionCount = 1) {
  return Math.max(0, Number(seconds) || 0) / 60 * Math.max(0, Number(sessionCount) || 0) * TRANSLATION_USD_PER_MINUTE;
}

export function estimateInterpretationCost(seconds, translationSessions = 1, transcriptionSessions = 0) {
  const minutes = Math.max(0, Number(seconds) || 0) / 60;
  return minutes * (
    Math.max(0, Number(translationSessions) || 0) * TRANSLATION_USD_PER_MINUTE
    + Math.max(0, Number(transcriptionSessions) || 0) * TRANSCRIPTION_USD_PER_MINUTE
  );
}

export function modeHasAudio(mode) {
  return mode !== "captions";
}

export function modeHasCaptions(mode) {
  return mode !== "audio";
}

export function buildTranslationTargets({ mode, inputLanguage, outputLanguage, captionLanguages = [] }) {
  const targets = [];
  if (modeHasAudio(mode)) targets.push(outputLanguage);
  if (modeHasCaptions(mode)) {
    targets.push(...captionLanguages.filter((code) => !["none", "source", inputLanguage].includes(code)));
  }
  if (!targets.length) targets.push(OUTPUT_LANGUAGES.find(({ code }) => code !== inputLanguage)?.code || "en");
  return [...new Set(targets.filter(Boolean))];
}

export function parseMacApplicationProcesses(output, excludedName = "Live Interpreter") {
  const unique = new Map();
  for (const line of String(output || "").split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.+?\.app)(?:\/|$)/);
    if (!match) continue;
    const pid = Number(match[1]);
    const appPath = match[2];
    const name = appPath.split("/").pop()?.replace(/\.app$/, "") || "";
    if (!pid || !name || name === excludedName) continue;
    if (!unique.has(appPath)) unique.set(appPath, { pid, name, appPath });
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, "ja"));
}

const COMMON_AUDIO_APP_NAMES = [
  "music", "ミュージック", "spotify", "amazon music", "youtube music", "tidal", "deezer",
  "podcasts", "quicktime player", "vlc", "iina", "elmedia player", "tv", "audacity",
  "logic pro", "garageband", "obs", "google chrome", "chrome", "safari", "firefox", "arc",
  "microsoft edge", "brave browser", "opera", "zoom", "zoom.us", "zoom workplace", "microsoft teams", "teams", "webex",
  "discord", "slack", "skype", "facetime",
];

export function isCommonAudioApp(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase("en-US");
  return COMMON_AUDIO_APP_NAMES.some((candidate) => normalized === candidate || normalized.startsWith(`${candidate} `) || normalized.startsWith(`${candidate}.`));
}

export function groupAudioSourceApps(apps) {
  const common = [];
  const other = [];
  for (const app of Array.isArray(apps) ? apps : []) {
    (isCommonAudioApp(app?.name) ? common : other).push(app);
  }
  return { common, other };
}
