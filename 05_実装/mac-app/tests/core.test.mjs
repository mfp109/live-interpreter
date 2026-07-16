import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  appendRollingText, appendTranscriptText, buildTranscriptExport, buildTranslationTargets, captionDisplayText, clamp, estimateInterpretationCost,
  extractClientSecret, groupAudioSourceApps, INPUT_LANGUAGES, isAllowedLanguage, modeHasAudio, modeHasCaptions, OUTPUT_LANGUAGES, parseMacApplicationProcesses, splitTranscriptSentences,
} from "../shared/core.mjs";
import { builtinUiTranslations, UI_STRINGS_JA, validUiTranslations } from "../shared/ui-i18n.mjs";

test("clamp limits volume", () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(0.4), 0.4);
  assert.equal(clamp(3), 1);
});

test("rolling captions remain bounded", () => {
  const value = appendRollingText("one two three ", "four five six", 12);
  assert.ok(value.length <= 12);
  assert.ok(value.endsWith("five six"));
});

test("transcript history is not truncated", () => {
  const original = "a".repeat(900);
  assert.equal(appendTranscriptText(original, "続き").length, 902);
});

test("transcript sentences become scrollable display lines", () => {
  assert.deepEqual(splitTranscriptSentences("こんにちは。今日はいい天気ですね。"), ["こんにちは。", "今日はいい天気ですね。"]);
  assert.equal(captionDisplayText("Hello. It's fine today."), "Hello.\nIt's fine today.");
});

test("transcript export supports individual, interleaved, and grouped layouts", () => {
  const input = { language1Text: "こんにちは。今日はいい天気ですね。", language2Text: "Hello. It's fine today." };
  assert.equal(buildTranscriptExport({ ...input, scope: "language1" }), "こんにちは。\n今日はいい天気ですね。");
  assert.equal(buildTranscriptExport({ ...input, scope: "both", layout: "interleaved" }), "こんにちは。\nHello.\n今日はいい天気ですね。\nIt's fine today.");
  assert.equal(buildTranscriptExport({ ...input, scope: "both", layout: "grouped" }), "こんにちは。今日はいい天気ですね。\n\nHello. It's fine today.");
});

test("client secret supports current response shapes", () => {
  assert.equal(extractClientSecret({ value: "secret-a" }), "secret-a");
  assert.equal(extractClientSecret({ client_secret: { value: "secret-b" } }), "secret-b");
});

test("language allowlist rejects unknown values", () => {
  assert.equal(isAllowedLanguage("ja"), true);
  assert.equal(isAllowedLanguage("id"), true);
  assert.equal(isAllowedLanguage("vi"), true);
  assert.equal(isAllowedLanguage("ar"), false);
  assert.equal(isAllowedLanguage("xx"), false);
});

test("official language lists are exposed", () => {
  assert.equal(OUTPUT_LANGUAGES.length, 13);
  assert.deepEqual(Object.fromEntries(OUTPUT_LANGUAGES.map(({ code, nativeLabel }) => [code, nativeLabel])), {
    es: "Español", pt: "Português", fr: "Français", ja: "日本語", ru: "Русский", zh: "中文", de: "Deutsch",
    ko: "한국어", hi: "हिन्दी", id: "Bahasa Indonesia", vi: "Tiếng Việt", it: "Italiano", en: "English",
  });
  assert.ok(INPUT_LANGUAGES.length > 70);
});

test("usage estimate includes translation and optional source transcription", () => {
  assert.equal(estimateInterpretationCost(60, 1, 0), 0.034);
  assert.equal(estimateInterpretationCost(60, 2, 1), 0.085);
});

test("output modes independently enable audio and captions", () => {
  assert.equal(modeHasAudio("audio"), true);
  assert.equal(modeHasCaptions("audio"), false);
  assert.equal(modeHasAudio("captions"), false);
  assert.equal(modeHasCaptions("captions"), true);
});

test("audio-only uses one audio target", () => {
  assert.deepEqual(buildTranslationTargets({ mode: "audio", inputLanguage: "zh", outputLanguage: "ja", captionLanguages: ["source", "en"] }), ["ja"]);
});

test("captions-only uses selected caption targets without audio target", () => {
  assert.deepEqual(buildTranslationTargets({ mode: "captions", inputLanguage: "zh", outputLanguage: "ja", captionLanguages: ["en", "ko"] }), ["en", "ko"]);
});

test("source-only captions keep one translation transport session", () => {
  const targets = buildTranslationTargets({ mode: "captions", inputLanguage: "zh", outputLanguage: "zh", captionLanguages: ["source", "none"] });
  assert.equal(targets.length, 1);
  assert.notEqual(targets[0], "zh");
});

test("macOS process output becomes a deduplicated app source list", () => {
  const output = [
    "  101 /System/Applications/Music.app/Contents/MacOS/Music",
    "  202 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "  203 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper",
    "  303 /Applications/Live Interpreter.app/Contents/MacOS/Live Interpreter",
    "  404 /System/Applications/QuickTime Player.app/Contents/MacOS/QuickTime Player",
  ].join("\n");
  assert.deepEqual(parseMacApplicationProcesses(output).map(({ name }) => name), ["Google Chrome", "Music", "QuickTime Player"]);
});

test("common audio apps are separated from utility apps", () => {
  const apps = [
    { pid: 1, name: "Music" },
    { pid: 2, name: "Google Chrome" },
    { pid: 3, name: "Logi Options+" },
    { pid: 4, name: "Mouse Driver Helper" },
    { pid: 5, name: "zoom.us" },
    { pid: 6, name: "Zoom Workplace" },
  ];
  const groups = groupAudioSourceApps(apps);
  assert.deepEqual(groups.common.map(({ name }) => name), ["Music", "Google Chrome", "zoom.us", "Zoom Workplace"]);
  assert.deepEqual(groups.other.map(({ name }) => name), ["Logi Options+", "Mouse Driver Helper"]);
});

test("selected app audio is isolated from direct hardware output", async () => {
  const source = await readFile(new URL("../native/process_audio_tap.m", import.meta.url), "utf8");
  assert.match(source, /description\.muteBehavior\s*=\s*CATapMuted;/);
  assert.doesNotMatch(source, /CATapMutedWhenTapped|CATapUnmuted/);
});

test("caption controls expose independent views, export, dragging, and source retention", async () => {
  const [index, captions, renderer, main] = await Promise.all([
    readFile(new URL("../renderer/index.html", import.meta.url), "utf8"),
    readFile(new URL("../renderer/captions.html", import.meta.url), "utf8"),
    readFile(new URL("../renderer/app.js", import.meta.url), "utf8"),
    readFile(new URL("../electron/main.mjs", import.meta.url), "utf8"),
  ]);
  for (const id of ["closeCaptionsButton", "captionFontSize1", "captionFontSize2", "captionRows1", "captionRows2", "exportCaptionsButton"]) assert.match(index, new RegExp(`id="${id}"`));
  assert.match(captions, /class="drag-handle"/);
  assert.match(renderer, /stopButton\.addEventListener\("click", \(\) => stopAll\(true\)\)/);
  assert.match(main, /"transcript:save"/);
});

test("either caption slot can be disabled for a single translated subtitle", async () => {
  const renderer = await readFile(new URL("../renderer/app.js", import.meta.url), "utf8");
  assert.match(renderer, /captionLanguage1\.replaceChildren\(\.\.\.captionLanguageOptions\(\)\)/);
  assert.match(renderer, /captionLanguage2\.replaceChildren\(\.\.\.captionLanguageOptions\(\)\)/);
  assert.match(renderer, /\.filter\(\(\{ code \}\) => code !== "none"\)/);
  assert.match(renderer, /字幕言語を1つ以上選んでください/);
});

test("audio and caption modes can be switched while translation stays active", async () => {
  const renderer = await readFile(new URL("../renderer/app.js", import.meta.url), "utf8");
  const lockBody = renderer.match(/function lockLanguageControls\(locked\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(lockBody, /outputMode/);
  assert.match(renderer, /async function switchOutputMode\(\)/);
  assert.match(renderer, /const wasLive = state\.startedAt > 0 \|\| state\.peers\.length > 0/);
  assert.match(renderer, /closeTranslation\(\);[\s\S]*await startTranslation\(\)/);
});

test("input, output, and both caption languages can change during translation", async () => {
  const renderer = await readFile(new URL("../renderer/app.js", import.meta.url), "utf8");
  assert.match(renderer, /elements\.stopButton\.disabled = false; elements\.outputMode\.disabled = false; lockLanguageControls\(false\)/);
  assert.match(renderer, /async function reconfigureActiveTranslation/);
  assert.match(renderer, /async function changeInputLanguage/);
  assert.match(renderer, /async function changeOutputLanguage/);
  assert.match(renderer, /async function changeCaptionLanguage/);
  for (const control of ["inputLanguage", "outputLanguage", "captionLanguage1", "captionLanguage2"]) {
    assert.match(renderer, new RegExp(`elements\\.${control}\\.addEventListener\\("change"`));
  }
});

test("the macOS app menu opens secure API key settings", async () => {
  const [main, settings, settingsRenderer] = await Promise.all([
    readFile(new URL("../electron/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../renderer/settings.html", import.meta.url), "utf8"),
    readFile(new URL("../renderer/settings.js", import.meta.url), "utf8"),
  ]);
  assert.match(main, /label: translations\.menuSettings, accelerator: "CommandOrControl\+,", click: openSettingsWindow/);
  assert.match(main, /Menu\.setApplicationMenu\(Menu\.buildFromTemplate\(template\)\)/);
  assert.match(main, /settingsWindow\.loadFile\(path\.join\(rendererDirectory, "settings\.html"\)\)/);
  assert.match(settings, /id="apiKey" type="password"/);
  assert.match(settingsRenderer, /bridge\.saveApiKey\(input\.value\)/);
  assert.doesNotMatch(settingsRenderer, /storedApiKey|decryptString/);
});

test("a key changed in settings overrides an environment fallback", async () => {
  const main = await readFile(new URL("../electron/main.mjs", import.meta.url), "utf8");
  const storedFunction = main.match(/async function storedApiKey\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.ok(storedFunction.indexOf("settings.encryptedApiKey") < storedFunction.indexOf("process.env.OPENAI_API_KEY"));
});

test("the API key is cached and migrated away from repeated Keychain access", async () => {
  const main = await readFile(new URL("../electron/main.mjs", import.meta.url), "utf8");
  const storedFunction = main.match(/async function storedApiKey\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.ok(storedFunction.indexOf("apiKeyCache") < storedFunction.indexOf("safeStorage.decryptString"));
  assert.match(main, /createCipheriv\("aes-256-gcm"/);
  assert.match(main, /settings\.localEncryptedApiKey = await encryptApiKey\(key\)/);
  assert.match(main, /delete settings\.encryptedApiKey/);
  assert.match(main, /apiKeyCache = normalized/);
});

test("app name is Live Interpreter without personal or platform suffixes", async () => {
  const [main, packageSource, packager] = await Promise.all([
    readFile(new URL("../electron/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/package-mac.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(main, /app\.setName\("Live Interpreter"\)/);
  assert.equal(JSON.parse(packageSource).productName, "Live Interpreter");
  assert.match(packager, /name: "Live Interpreter"/);
  assert.match(packager, /CFBundleDisplayName: "Live Interpreter"/);
  assert.match(packager, /appBundleId: "tech\.shalomworks\.live-interpreter"/);
  assert.match(main, /app\.getPath\("appData"\), "asaph-live-interpreter-mac", "settings\.json"/);
  const index = await readFile(new URL("../renderer/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(index, /多言語ライブ通訳|Mac版|会議音声・動画・配信に対応|Live Interpreter Mixer|asaph-live/i);
});

test("settings offers every realtime output language as an app language", async () => {
  const [main, settings, preload] = await Promise.all([
    readFile(new URL("../electron/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../renderer/settings.js", import.meta.url), "utf8"),
    readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8"),
  ]);
  assert.equal(OUTPUT_LANGUAGES.length, 13);
  assert.equal(validUiTranslations(UI_STRINGS_JA), true);
  for (const { code } of OUTPUT_LANGUAGES) assert.equal(validUiTranslations(builtinUiTranslations(code)), true, code);
  assert.match(main, /options: OUTPUT_LANGUAGES/);
  assert.match(main, /builtinUiTranslations\(code\)/);
  assert.doesNotMatch(main, /createUiTranslations|asaph-live-interpreter-ui-language|Target language:/);
  assert.match(settings, /locale\.options\.map/);
  assert.match(settings, /nativeLabel \|\| label/);
  assert.doesNotMatch(settings, /Intl\.DisplayNames/);
  assert.match(preload, /ui-language:set/);
});

test("external captions use a normal shareable macOS window", async () => {
  const main = await readFile(new URL("../electron/main.mjs", import.meta.url), "utf8");
  assert.match(main, /title:\s*"共有用字幕｜Live Interpreter"/);
  assert.match(main, /transparent:\s*false/);
  assert.match(main, /backgroundColor:\s*"#05070b"/);
  assert.match(main, /hasShadow:\s*true/);
  assert.match(main, /frame:\s*true/);
  assert.match(main, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(main, /setContentProtection\(false\)/);
  assert.match(main, /setHiddenInMissionControl\(false\)/);
  assert.match(main, /setWindowButtonVisibility\(false\)/);
});

test("external caption chrome only appears while the pointer is over the window", async () => {
  const [css, renderer, preload, main] = await Promise.all([
    readFile(new URL("../renderer/captions.css", import.meta.url), "utf8"),
    readFile(new URL("../renderer/captions.js", import.meta.url), "utf8"),
    readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../electron/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(css, /body\s*\{[^}]*background:\s*rgb\(5, 7, 11\)/s);
  assert.match(css, /body\.transparent\s*\{[^}]*background:\s*rgba\(5, 7, 11, \.46\)/s);
  assert.match(css, /\.drag-handle\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /body:hover \.drag-handle\s*\{[^}]*opacity:\s*1/s);
  assert.match(css, /body:hover::after\s*\{[^}]*border-color:/s);
  assert.match(renderer, /setCaptionWindowHovered\(true\)/);
  assert.match(preload, /captions:set-window-hovered/);
  assert.match(main, /setWindowButtonVisibility\(Boolean\(hovered\)\)/);
  assert.match(main, /setOpacity\(latestCaptionPayload\.transparent \? 0\.72 : 1\)/);
});

test("audio source UI omits the explanatory app-source copy", async () => {
  const index = await readFile(new URL("../renderer/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(index, /アプリ単位で音声を選択|Music、Chrome、Zoomなど/);
});

test("native audio tap resolves child audio processes for Safari-style apps", async () => {
  const source = await readFile(new URL("../native/process_audio_tap.m", import.meta.url), "utf8");
  assert.match(source, /processIsDescendantOf/);
  assert.match(source, /audioProcessObjectsForApplicationPID/);
  assert.match(source, /initStereoMixdownOfProcesses:processIDs/);
});

test("audio source picker includes microphones without monitoring them to speakers", async () => {
  const [index, renderer] = await Promise.all([
    readFile(new URL("../renderer/index.html", import.meta.url), "utf8"),
    readFile(new URL("../renderer/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(index, /id="microphoneList"/);
  assert.match(renderer, /selectMicrophoneSource/);
  assert.match(renderer, /state\.captureKind === "microphone"/);
  assert.match(renderer, /originalAudio\.pause\(\)/);
});

test("audio source picker can route local audio and video files", async () => {
  const [index, renderer] = await Promise.all([
    readFile(new URL("../renderer/index.html", import.meta.url), "utf8"),
    readFile(new URL("../renderer/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(index, /id="selectMediaFileButton"/);
  assert.match(index, /accept="audio\/\*,video\/\*/);
  assert.match(renderer, /createMediaElementSource/);
  assert.match(renderer, /createMediaStreamDestination/);
  assert.match(renderer, /activateCaptureStream\(destination\.stream/);
});
