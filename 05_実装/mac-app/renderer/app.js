import {
  appendTranscriptText, buildTranscriptExport, buildTranslationTargets, captionDisplayText, clamp, estimateInterpretationCost,
  groupAudioSourceApps, INPUT_LANGUAGES, modeHasAudio, modeHasCaptions, OUTPUT_LANGUAGES,
} from "../shared/core.mjs";

const bridge = window.interpreterDesktop;
const $ = (selector) => document.querySelector(selector);
const elements = {
  outputMode: $("#outputMode"), inputLanguage: $("#inputLanguage"), outputLanguage: $("#outputLanguage"), audioLanguageControl: $("#audioLanguageControl"),
  audioControls: $("#audioControls"), captionControls: $("#captionControls"), captionPreview: $("#captionPreview"), translatedChannelTitle: $("#translatedChannelTitle"),
  sourceName: $("#sourceName"), selectSourceButton: $("#selectSourceButton"), sourcePicker: $("#sourcePicker"), audioAppList: $("#audioAppList"),
  microphoneList: $("#microphoneList"),
  refreshSourcesButton: $("#refreshSourcesButton"), closeSourcesButton: $("#closeSourcesButton"), selectWindowSourceButton: $("#selectWindowSourceButton"), originalVolume: $("#originalVolume"),
  selectMediaFileButton: $("#selectMediaFileButton"), mediaFileInput: $("#mediaFileInput"), sourceMediaPanel: $("#sourceMediaPanel"), sourceMediaContainer: $("#sourceMediaContainer"),
  originalVolumeText: $("#originalVolumeText"), translatedVolume: $("#translatedVolume"), translatedVolumeText: $("#translatedVolumeText"),
  originalMute: $("#originalMute"), translatedMute: $("#translatedMute"), originalOutput: $("#originalOutput"),
  translatedOutput: $("#translatedOutput"),
  originalMeter: $("#originalMeter"), translatedMeter: $("#translatedMeter"), captionLanguage1: $("#captionLanguage1"),
  captionLanguage2: $("#captionLanguage2"), captionFontSize1: $("#captionFontSize1"), captionFontSizeText1: $("#captionFontSizeText1"),
  captionFontSize2: $("#captionFontSize2"), captionFontSizeText2: $("#captionFontSizeText2"), captionRows1: $("#captionRows1"), captionRows2: $("#captionRows2"),
  captionTransparent: $("#captionTransparent"), captionAlwaysOnTop: $("#captionAlwaysOnTop"), openCaptionsButton: $("#openCaptionsButton"), closeCaptionsButton: $("#closeCaptionsButton"),
  exportCaptionsButton: $("#exportCaptionsButton"), exportDialog: $("#exportDialog"), exportScope: $("#exportScope"), exportLayout: $("#exportLayout"),
  exportLayoutControl: $("#exportLayoutControl"), saveTranscriptButton: $("#saveTranscriptButton"),
  captionPreviewSection1: $("#captionPreviewSection1"), captionPreviewSection2: $("#captionPreviewSection2"),
  captionPreviewLabel1: $("#captionPreviewLabel1"), captionPreviewLabel2: $("#captionPreviewLabel2"), captionPreview1: $("#captionPreview1"), captionPreview2: $("#captionPreview2"),
  startButton: $("#startButton"), stopButton: $("#stopButton"), message: $("#message"), statusBadge: $("#statusBadge"),
  statusText: $("#statusText"), originalAudio: $("#originalAudio"), translatedAudio: $("#translatedAudio"),
  sessionTime: $("#sessionTime"), sessionCount: $("#sessionCount"), sessionCost: $("#sessionCost"), monthlyCost: $("#monthlyCost"),
};

const state = {
  captureStream: null, captureKind: "", peers: [], meterStops: [],
  sourceText: "", translations: new Map(), stopping: false, startedAt: 0, timer: 0,
  activeSessions: 0, transcriptionSessions: 0, lastSessionSeconds: 0,
  lastSessionCount: 0, lastTranscriptionCount: 0, mediaPlayback: null,
  reconfiguring: false, captionWindowRequested: false,
  uiLanguage: "ja", uiTranslations: {},
};

function t(key, fallback = "") { return state.uiTranslations[key] || fallback; }

function applyUiLanguage(locale) {
  state.uiLanguage = locale?.code || "ja";
  state.uiTranslations = locale?.translations || {};
  document.documentElement.lang = state.uiLanguage;
  document.documentElement.dir = ["ar", "fa", "he"].includes(state.uiLanguage) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    if (["statusText", "message"].includes(element.id)) return;
    const text = t(element.dataset.i18n);
    if (text) element.textContent = text;
  });
  document.title = t("appTitle", "Live Interpreter");
  if (elements.statusBadge.dataset.state === "idle") elements.statusText.textContent = t("ready", "待機中");
  if (!state.captureStream) elements.message.textContent = t("initialMessage", "最初に会議・画面音声を選んでください。");
}

function languageLabel(code) {
  try { return new Intl.DisplayNames([state.uiLanguage], { type: "language" }).of(code) || code; } catch { return [...INPUT_LANGUAGES, ...OUTPUT_LANGUAGES].find((language) => language.code === code)?.label || code; }
}

function populateLanguages() {
  elements.inputLanguage.replaceChildren(...INPUT_LANGUAGES.map(({ code }) => new Option(languageLabel(code), code)));
  elements.outputLanguage.replaceChildren(...OUTPUT_LANGUAGES.map(({ code }) => new Option(languageLabel(code), code)));
  elements.inputLanguage.value = "zh";
  elements.outputLanguage.value = "ja";
  refreshCaptionOptions("source", "ja");
  updateLanguageLabels();
}

function refreshCaptionOptions(firstValue = elements.captionLanguage1.value, secondValue = elements.captionLanguage2.value) {
  const captionLanguageOptions = () => [
    new Option(t("none", "なし"), "none"),
    new Option(`${t("source", "原語")}（${languageLabel(elements.inputLanguage.value)}）`, "source"),
    ...OUTPUT_LANGUAGES.map(({ code }) => new Option(languageLabel(code), code)),
  ];
  elements.captionLanguage1.replaceChildren(...captionLanguageOptions());
  elements.captionLanguage2.replaceChildren(...captionLanguageOptions());
  elements.captionLanguage1.value = [...elements.captionLanguage1.options].some((option) => option.value === firstValue) ? firstValue : "source";
  elements.captionLanguage2.value = [...elements.captionLanguage2.options].some((option) => option.value === secondValue) ? secondValue : "none";
}

function setMessage(text, kind = "") { elements.message.textContent = text; elements.message.className = kind; }
function setStatus(name, text) { elements.statusBadge.dataset.state = name; elements.statusText.textContent = text; }
function pressed(button) { return button.getAttribute("aria-pressed") === "true"; }
function audioEnabled() { return modeHasAudio(elements.outputMode.value); }
function captionsEnabled() { return modeHasCaptions(elements.outputMode.value); }

function updateModeUI() {
  elements.audioLanguageControl.classList.toggle("mode-hidden", !audioEnabled());
  elements.audioControls.classList.toggle("mode-hidden", !audioEnabled());
  elements.captionControls.classList.toggle("mode-hidden", !captionsEnabled());
  elements.captionPreview.classList.toggle("mode-hidden", !captionsEnabled());
  elements.startButton.textContent = elements.outputMode.value === "audio" ? t("modeAudio", "音声のみ") : elements.outputMode.value === "captions" ? t("modeCaptions", "字幕のみ") : t("start", "通訳を開始");
  if (!captionsEnabled()) bridge?.hideCaptions();
  else if (state.captionWindowRequested) bridge?.openCaptions();
  publishCaptions();
}

function updateLanguageLabels() {
  elements.translatedChannelTitle.textContent = `${languageLabel(elements.outputLanguage.value)} ${t("interpreter", "通訳")}`;
  publishCaptions();
}

function updateVolumes() {
  elements.originalAudio.volume = clamp(elements.originalVolume.value);
  elements.originalAudio.muted = pressed(elements.originalMute);
  elements.translatedAudio.volume = clamp(elements.translatedVolume.value);
  elements.translatedAudio.muted = pressed(elements.translatedMute);
  elements.originalVolumeText.textContent = `${Math.round(clamp(elements.originalVolume.value) * 100)}%`;
  elements.translatedVolumeText.textContent = `${Math.round(clamp(elements.translatedVolume.value) * 100)}%`;
}

async function updateOutputDevices() {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audiooutput");
  for (const select of [elements.originalOutput, elements.translatedOutput]) {
    const previous = select.value;
    select.replaceChildren(new Option(t("defaultOutput", "Macの標準出力"), ""));
    devices.forEach((device, index) => select.append(new Option(device.label || `音声出力 ${index + 1}`, device.deviceId)));
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
}

async function setSink(audio, sinkId) {
  if (typeof audio.setSinkId !== "function") return setMessage("この環境では個別の出力先を選べません。Macの標準出力を使用します。", "error");
  try { await audio.setSinkId(sinkId); } catch { setMessage("選択した出力機器へ切り替えられませんでした。", "error"); }
}

function meter(stream, meterElement, kind) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(stream).connect(analyser);
  const values = new Uint8Array(analyser.fftSize);
  let frame; let active = true;
  const stop = () => { active = false; cancelAnimationFrame(frame); context.close().catch(() => {}); };
  state.meterStops.push({ kind, stop });
  const draw = () => {
    if (!active) return;
    analyser.getByteTimeDomainData(values);
    let sum = 0;
    for (const value of values) { const normalized = (value - 128) / 128; sum += normalized * normalized; }
    const rms = Math.sqrt(sum / values.length);
    meterElement.style.width = `${Math.min(100, Math.round(rms * 520))}%`;
    frame = requestAnimationFrame(draw);
  };
  draw();
}

function selectedCaptionLines() {
  if (!captionsEnabled()) return [];
  return [
    { code: elements.captionLanguage1.value, fontSize: Number(elements.captionFontSize1.value), rows: Number(elements.captionRows1.value) },
    { code: elements.captionLanguage2.value, fontSize: Number(elements.captionFontSize2.value), rows: Number(elements.captionRows2.value) },
  ]
    .filter(({ code }) => code !== "none")
    .map(({ code, fontSize, rows }) => {
      const isSource = code === "source" || code === elements.inputLanguage.value;
      const actualCode = isSource ? elements.inputLanguage.value : code;
      const rawText = isSource ? state.sourceText : state.translations.get(code) || "";
      return {
        code: actualCode,
        label: isSource ? `${languageLabel(actualCode)}（原語）` : languageLabel(actualCode),
        rawText,
        text: captionDisplayText(rawText),
        fontSize,
        rows,
      };
    });
}

function updateScrollableCaption(element, text) {
  const shouldFollow = !element.dataset.ready || element.scrollHeight - element.scrollTop - element.clientHeight < 36;
  element.textContent = text;
  element.dataset.ready = "true";
  if (shouldFollow) requestAnimationFrame(() => { element.scrollTop = element.scrollHeight; });
}

function publishCaptions() {
  const lines = selectedCaptionLines();
  const sections = [elements.captionPreviewSection1, elements.captionPreviewSection2];
  const labels = [elements.captionPreviewLabel1, elements.captionPreviewLabel2];
  const previews = [elements.captionPreview1, elements.captionPreview2];
  sections.forEach((section, index) => {
    const line = lines[index];
    section.hidden = !line;
    if (!line) return;
    labels[index].textContent = line.label;
    previews[index].style.fontSize = `${line.fontSize}px`;
    previews[index].style.height = `${Math.ceil(line.fontSize * 1.45 * line.rows)}px`;
    updateScrollableCaption(previews[index], line.text || `${line.label}字幕がここに表示されます。`);
  });
  bridge?.updateCaptions({ lines, transparent: elements.captionTransparent.checked });
}

function handleRealtimeEvent(event, targetLanguage, captureSource) {
  if (event.type === "session.input_transcript.delta" && captureSource) {
    state.sourceText = appendTranscriptText(state.sourceText, event.delta);
    publishCaptions();
  } else if (event.type === "session.output_transcript.delta") {
    state.translations.set(targetLanguage, appendTranscriptText(state.translations.get(targetLanguage), event.delta));
    publishCaptions();
  } else if (event.type === "error") {
    failSafe("翻訳処理でエラーが発生しました。");
  }
}

function monthCost() {
  const month = new Date().toISOString().slice(0, 7);
  if (localStorage.getItem("interpreter.usageMonth") !== month) {
    localStorage.setItem("interpreter.usageMonth", month);
    localStorage.setItem("interpreter.estimatedCost", "0");
  }
  return Number(localStorage.getItem("interpreter.estimatedCost")) || 0;
}

function elapsedSeconds() { return state.startedAt ? Math.max(0, (Date.now() - state.startedAt) / 1000) : state.lastSessionSeconds; }

function updateUsage() {
  const elapsed = elapsedSeconds();
  const translations = state.startedAt ? state.activeSessions : state.lastSessionCount;
  const transcriptions = state.startedAt ? state.transcriptionSessions : state.lastTranscriptionCount;
  const currentCost = state.startedAt ? estimateInterpretationCost(elapsed, translations, transcriptions) : 0;
  elements.sessionTime.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
  elements.sessionCount.textContent = `${translations}本${transcriptions ? "＋原語字幕" : ""}`;
  elements.sessionCost.textContent = `$${estimateInterpretationCost(elapsed, translations, transcriptions).toFixed(4)}`;
  elements.monthlyCost.textContent = `$${(monthCost() + currentCost).toFixed(4)}`;
}

function startUsage(sessionCount, transcriptionCount) {
  state.activeSessions = sessionCount; state.transcriptionSessions = transcriptionCount; state.startedAt = Date.now(); state.lastSessionSeconds = 0;
  clearInterval(state.timer); state.timer = setInterval(updateUsage, 500); updateUsage();
}

function commitUsage() {
  if (!state.startedAt) return;
  const elapsed = elapsedSeconds();
  const cost = estimateInterpretationCost(elapsed, state.activeSessions, state.transcriptionSessions);
  localStorage.setItem("interpreter.estimatedCost", String(monthCost() + cost));
  state.lastSessionSeconds = elapsed; state.lastSessionCount = state.activeSessions; state.lastTranscriptionCount = state.transcriptionSessions;
  state.startedAt = 0; clearInterval(state.timer); state.timer = 0; updateUsage();
}

function lockLanguageControls(locked) {
  for (const control of [elements.inputLanguage, elements.outputLanguage, elements.captionLanguage1, elements.captionLanguage2]) control.disabled = locked;
}

async function syncOriginalMonitor() {
  state.meterStops.filter((entry) => entry.kind === "original").forEach((entry) => entry.stop());
  state.meterStops = state.meterStops.filter((entry) => entry.kind !== "original");
  elements.originalMeter.style.width = "0%";
  const audioTrack = state.captureStream?.getAudioTracks()[0];
  if (!audioTrack || !audioEnabled()) {
    elements.originalAudio.pause();
    elements.originalAudio.srcObject = null;
    return;
  }
  const audioOnly = new MediaStream([audioTrack]);
  if (state.captureKind === "microphone") {
    elements.originalAudio.pause();
    elements.originalAudio.srcObject = null;
    meter(audioOnly, elements.originalMeter, "original");
    return;
  }
  elements.originalAudio.srcObject = audioOnly;
  await elements.originalAudio.play();
  meter(audioOnly, elements.originalMeter, "original");
}

async function activateCaptureStream(stream, sourceLabel, kind) {
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("選択した対象から音声を取得できませんでした。音声を再生してから選び直してください。");
  }
  state.captureStream = stream;
  state.captureKind = kind;
  elements.sourceName.textContent = sourceLabel || audioTrack.label || "選択したアプリ音声";
  audioTrack.onended = () => { if (!state.stopping) stopAll(false, "取得元が終了したため音声選択を解除しました。"); };
  await syncOriginalMonitor();
  await updateOutputDevices();
  setStatus("idle", "音声選択済み");
  setMessage(`${elements.sourceName.textContent}を音声元に設定しました。`, "success");
  elements.startButton.disabled = false;
  elements.sourcePicker.classList.add("mode-hidden");
}

async function selectWindowSource() {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("このMacでは会議音声取得を利用できません。");
  if (state.captureStream) await stopAll(false);
  await bridge.stopProcessAudio();
  setStatus("connecting", "音声を選択中");
  setMessage("macOSの選択画面で、通訳したいアプリまたはウインドウを選んでください。");
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: 320, height: 180, frameRate: 1 }, audio: { suppressLocalAudioPlayback: true },
    systemAudio: "include", windowAudio: "window", selfBrowserSurface: "exclude",
  });
  const videoTrack = stream.getVideoTracks()[0];
  const sourceLabel = videoTrack?.label || "選択した画面・ウインドウ";
  videoTrack?.stop();
  await activateCaptureStream(stream, sourceLabel, "window");
}

async function waitForAudioDevice(deviceName) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const device = devices.find((item) => item.kind === "audioinput" && (item.label === deviceName || item.label.includes(deviceName)));
    if (device) return device;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("選択したアプリの音声デバイスをMacで確認できませんでした。");
}

async function selectProcessSource(info) {
  if (state.captureStream) await stopAll(false);
  setStatus("connecting", "アプリ音声を準備中");
  setMessage(`${info.name}の音声を準備しています。`);
  try {
    const tap = await bridge.startProcessAudio(info.pid);
    const device = await waitForAudioDevice(tap.deviceName);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { deviceId: { exact: device.deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await activateCaptureStream(stream, `アプリ：${tap.name}`, "process");
  } catch (error) {
    await bridge.stopProcessAudio();
    throw error;
  }
}

function microphonePriority(device) {
  return /内蔵|built-in|macbook|internal/i.test(device.label || "") ? 0 : 1;
}

async function loadMicrophones() {
  elements.microphoneList.replaceChildren(Object.assign(document.createElement("p"), { textContent: "マイクを確認しています…" }));
  try {
    let devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput" && !device.label.startsWith("Live Interpreter -"));
    if (devices.length && devices.every((device) => !device.label)) {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      permissionStream.getTracks().forEach((track) => track.stop());
      devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput" && !device.label.startsWith("Live Interpreter -"));
    }
    const unique = new Map();
    for (const device of devices) {
      const key = device.groupId || device.label || device.deviceId;
      if (!unique.has(key) || unique.get(key).deviceId === "default") unique.set(key, device);
    }
    const microphones = [...unique.values()].sort((left, right) => microphonePriority(left) - microphonePriority(right) || left.label.localeCompare(right.label, "ja"));
    elements.microphoneList.replaceChildren();
    if (!microphones.length) {
      elements.microphoneList.append(Object.assign(document.createElement("p"), { textContent: "利用できるマイクが見つかりません。" }));
      return;
    }
    const grid = document.createElement("div");
    grid.className = "audio-app-grid";
    for (const [index, device] of microphones.entries()) {
      const button = document.createElement("button");
      button.className = "audio-app microphone";
      const label = device.label || (index === 0 ? "内蔵マイク" : `マイク ${index + 1}`);
      button.append(Object.assign(document.createElement("strong"), { textContent: label }));
      button.addEventListener("click", () => selectMicrophoneSource(device, label).catch((error) => { setStatus("error", "音声選択エラー"); setMessage(error?.message || "マイクを選択できませんでした。", "error"); }));
      grid.append(button);
    }
    elements.microphoneList.append(grid);
  } catch (error) {
    elements.microphoneList.replaceChildren(Object.assign(document.createElement("p"), { textContent: "マイクの使用を許可すると選択できます。" }));
  }
}

async function selectMicrophoneSource(device, label) {
  if (state.captureStream) await stopAll(false);
  await bridge.stopProcessAudio();
  setStatus("connecting", "マイクを準備中");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: { deviceId: device.deviceId ? { exact: device.deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  await activateCaptureStream(stream, `マイク：${label}`, "microphone");
}

async function releaseMediaPlayback() {
  if (!state.mediaPlayback) return;
  const { element, context, url } = state.mediaPlayback;
  element.pause();
  URL.revokeObjectURL(url);
  await context.close().catch(() => {});
  state.mediaPlayback = null;
  elements.sourceMediaContainer.replaceChildren();
  elements.sourceMediaPanel.classList.add("mode-hidden");
}

async function selectMediaFile(file) {
  if (!file) return;
  if (state.captureStream) await stopAll(false);
  await bridge.stopProcessAudio();
  setStatus("connecting", "ファイル音声を準備中");
  const element = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
  const url = URL.createObjectURL(file);
  element.src = url;
  element.controls = true;
  element.preload = "auto";
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const source = context.createMediaElementSource(element);
  const destination = context.createMediaStreamDestination();
  source.connect(destination);
  state.mediaPlayback = { element, context, source, destination, url };
  elements.sourceMediaContainer.replaceChildren(element);
  elements.sourceMediaPanel.classList.remove("mode-hidden");
  try {
    await context.resume();
    await element.play();
    await activateCaptureStream(destination.stream, `ファイル：${file.name}`, "media-file");
  } catch (error) {
    await releaseMediaPlayback();
    throw error;
  }
}

async function loadAudioApps() {
  elements.audioAppList.replaceChildren(Object.assign(document.createElement("p"), { textContent: "音声アプリを確認しています…" }));
  try {
    const apps = await bridge.listAudioApps();
    elements.audioAppList.replaceChildren();
    if (!apps.length) {
      elements.audioAppList.append(Object.assign(document.createElement("p"), { textContent: "音声アプリが見つかりません。Musicなどで音声を再生してから「一覧を更新」を押してください。" }));
      return;
    }
    const createAppButton = (info) => {
      const button = document.createElement("button");
      button.className = "audio-app";
      button.append(Object.assign(document.createElement("strong"), { textContent: info.name }));
      button.addEventListener("click", () => selectProcessSource(info).catch((error) => { setStatus("error", "音声選択エラー"); setMessage(error?.message || "アプリ音声を選択できませんでした。", "error"); }));
      return button;
    };
    const { common, other } = groupAudioSourceApps(apps);
    if (common.length) {
      const primary = document.createElement("div");
      primary.className = "audio-app-grid";
      primary.append(...common.map(createAppButton));
      elements.audioAppList.append(primary);
    } else {
      elements.audioAppList.append(Object.assign(document.createElement("p"), { textContent: "Music、ブラウザ、会議アプリなどが見つかりません。音声を再生してから一覧を更新してください。" }));
    }
    if (other.length) {
      const details = document.createElement("details");
      details.className = "other-audio-apps";
      const summary = Object.assign(document.createElement("summary"), { textContent: `その他のアプリ（${other.length}件）` });
      const grid = document.createElement("div");
      grid.className = "audio-app-grid";
      grid.append(...other.map(createAppButton));
      details.append(summary, grid);
      elements.audioAppList.append(details);
    }
  } catch (error) {
    elements.audioAppList.replaceChildren(Object.assign(document.createElement("p"), { textContent: error?.message || "音声アプリ一覧を取得できませんでした。" }));
  }
}

async function openSourcePicker() {
  elements.sourcePicker.classList.remove("mode-hidden");
  await Promise.all([loadMicrophones(), loadAudioApps()]);
}

async function openTranslationPeer(targetLanguage, { playAudio = false, transcribeSource = false } = {}) {
  const { clientSecret } = await bridge.createTranslationSession(targetLanguage, transcribeSource);
  const peer = new RTCPeerConnection();
  const entry = { peer, targetLanguage }; state.peers.push(entry);
  peer.addTrack(state.captureStream.getAudioTracks()[0], state.captureStream);
  if (playAudio) {
    peer.ontrack = async ({ streams }) => {
      const stream = streams[0]; elements.translatedAudio.srcObject = stream; updateVolumes(); await elements.translatedAudio.play();
      meter(stream, elements.translatedMeter, "translated");
    };
  }
  peer.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(peer.connectionState) && !state.stopping) failSafe("翻訳接続が切れました。");
  };
  const channel = peer.createDataChannel("oai-events"); entry.channel = channel;
  channel.onmessage = ({ data }) => { try { handleRealtimeEvent(JSON.parse(data), targetLanguage, transcribeSource); } catch { /* malformed service event */ } };
  const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
  const response = await fetch("https://api.openai.com/v1/realtime/translations/calls", {
    method: "POST", headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" }, body: offer.sdp,
  });
  if (!response.ok) throw new Error("OpenAIとの音声接続に失敗しました。");
  await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
}

function requiredTargets() {
  return buildTranslationTargets({
    mode: elements.outputMode.value,
    inputLanguage: elements.inputLanguage.value,
    outputLanguage: elements.outputLanguage.value,
    captionLanguages: [elements.captionLanguage1.value, elements.captionLanguage2.value],
  });
}

async function startTranslation() {
  if (!state.captureStream?.getAudioTracks()[0]) return setMessage("先に会議・画面音声を選んでください。", "error");
  if (audioEnabled() && elements.inputLanguage.value === elements.outputLanguage.value) return setMessage("入力言語と通訳言語には異なる言語を選んでください。", "error");
  if (captionsEnabled() && [elements.captionLanguage1.value, elements.captionLanguage2.value].every((code) => code === "none")) return setMessage("字幕言語を1つ以上選んでください。", "error");
  setStatus("connecting", "接続中"); setMessage("翻訳セッションを準備しています。"); elements.startButton.disabled = true; elements.outputMode.disabled = true; lockLanguageControls(true);
  const targets = requiredTargets();
  const transcribeSource = captionsEnabled() && [elements.captionLanguage1.value, elements.captionLanguage2.value]
    .some((code) => code === "source" || code === elements.inputLanguage.value);
  try {
    await Promise.all(targets.map((target, index) => openTranslationPeer(target, {
      playAudio: audioEnabled() && target === elements.outputLanguage.value,
      transcribeSource: index === 0 && transcribeSource,
    })));
    startUsage(targets.length, transcribeSource ? 1 : 0); setStatus("live", "通訳中");
    const modeMessage = elements.outputMode.value === "audio" ? `${languageLabel(elements.outputLanguage.value)}の音声通訳` : elements.outputMode.value === "captions" ? "字幕表示" : `${languageLabel(elements.outputLanguage.value)}の音声通訳と字幕表示`;
    setMessage(`${modeMessage}を実行中です。翻訳セッションは${targets.length}本です。`, "success");
    elements.stopButton.disabled = false; elements.outputMode.disabled = false; lockLanguageControls(false);
  } catch (error) { elements.outputMode.disabled = false; failSafe(error?.message || "翻訳を開始できませんでした。"); }
}

function configurationError() {
  if (audioEnabled() && elements.inputLanguage.value === elements.outputLanguage.value) return "入力言語と通訳言語には異なる言語を選んでください。";
  if (captionsEnabled() && [elements.captionLanguage1.value, elements.captionLanguage2.value].every((code) => code === "none")) return "字幕言語を1つ以上選んでください。";
  return "";
}

async function reconfigureActiveTranslation({ modeChanged = false } = {}) {
  const wasLive = state.startedAt > 0 || state.peers.length > 0;
  if (modeChanged) {
    updateModeUI();
    await syncOriginalMonitor();
  } else {
    publishCaptions();
  }
  const error = configurationError();
  if (error) return setMessage(error, "error");
  if (!wasLive) {
    if (state.captureStream) {
      setStatus("idle", "音声選択済み");
      setMessage("設定を変更しました。音声元はそのまま使用できます。", "success");
    }
    return;
  }
  state.reconfiguring = true;
  elements.outputMode.disabled = true;
  state.stopping = true;
  closeTranslation();
  state.stopping = false;
  await startTranslation();
  state.reconfiguring = false;
  elements.outputMode.disabled = false;
}

async function switchOutputMode() {
  await reconfigureActiveTranslation({ modeChanged: true });
}

async function changeInputLanguage() {
  const values = [elements.captionLanguage1.value, elements.captionLanguage2.value];
  refreshCaptionOptions(...values);
  updateLanguageLabels();
  await reconfigureActiveTranslation();
}

async function changeOutputLanguage() {
  updateLanguageLabels();
  await reconfigureActiveTranslation();
}

async function changeCaptionLanguage() {
  updateCaptionSettings();
  await reconfigureActiveTranslation();
}

function closeTranslation() {
  state.peers.forEach(({ peer }) => peer.close()); state.peers = [];
  elements.translatedAudio.pause(); elements.translatedAudio.srcObject = null;
  state.meterStops.filter((entry) => entry.kind === "translated").forEach((entry) => entry.stop());
  state.meterStops = state.meterStops.filter((entry) => entry.kind !== "translated"); elements.translatedMeter.style.width = "0%"; commitUsage(); lockLanguageControls(false);
}

function failSafe(message) {
  closeTranslation(); updateVolumes(); setStatus("error", "翻訳エラー");
  setMessage(message, "error"); elements.startButton.disabled = !state.captureStream; elements.stopButton.disabled = true;
}

async function stopAll(keepCapture = false, message = "通訳を終了しました。") {
  state.stopping = true; closeTranslation();
  if (!keepCapture) {
    state.captureStream?.getTracks().forEach((track) => track.stop()); state.captureStream = null;
    elements.originalAudio.pause(); elements.originalAudio.srcObject = null; elements.sourceName.textContent = "未選択"; state.captureKind = "";
    await bridge.stopProcessAudio();
    await releaseMediaPlayback();
    state.meterStops.splice(0).forEach((entry) => entry.stop()); elements.originalMeter.style.width = "0%";
  }
  elements.translatedMeter.style.width = "0%";
  updateVolumes(); setStatus("idle", keepCapture ? "音声選択済み" : "待機中");
  setMessage(message); elements.startButton.disabled = !state.captureStream; elements.stopButton.disabled = true; state.activeSessions = 0; updateUsage(); state.stopping = false;
}

function updateExportLayoutControl() {
  elements.exportLayoutControl.hidden = elements.exportScope.value !== "both";
}

function openExportDialog() {
  const lines = selectedCaptionLines();
  const first = lines[0]?.rawText?.trim();
  const second = lines[1]?.rawText?.trim();
  if (!first && !second) return setMessage("出力できる字幕がまだありません。", "error");
  const options = [...elements.exportScope.options];
  options.find(({ value }) => value === "language1").disabled = !first;
  options.find(({ value }) => value === "language2").disabled = !second;
  options.find(({ value }) => value === "both").disabled = !first || !second;
  elements.exportScope.value = first && second ? "both" : first ? "language1" : "language2";
  updateExportLayoutControl();
  elements.exportDialog.showModal();
}

async function saveTranscript() {
  const lines = selectedCaptionLines();
  const content = buildTranscriptExport({
    language1Text: lines[0]?.rawText || "",
    language2Text: lines[1]?.rawText || "",
    scope: elements.exportScope.value,
    layout: elements.exportLayout.value,
  });
  try {
    const result = await bridge.saveTranscript(content);
    if (!result?.saved) return;
    elements.exportDialog.close();
    setMessage(`字幕を保存しました：${result.filePath}`, "success");
  } catch (error) {
    setMessage(error?.message || "字幕を保存できませんでした。", "error");
  }
}

function updateCaptionSettings() {
  elements.captionRows1.value = String(Math.min(12, Math.max(1, Number(elements.captionRows1.value) || 2)));
  elements.captionRows2.value = String(Math.min(12, Math.max(1, Number(elements.captionRows2.value) || 5)));
  elements.captionFontSizeText1.textContent = `${elements.captionFontSize1.value}px`;
  elements.captionFontSizeText2.textContent = `${elements.captionFontSize2.value}px`;
  publishCaptions();
}

async function initialize() {
  if (!bridge) return setMessage("Live Interpreterから起動してください。", "error");
  applyUiLanguage(await bridge.getUiLanguage());
  populateLanguages();
  monthCost(); updateUsage(); updateVolumes(); updateModeUI();
  await updateOutputDevices().catch(() => {});
}

bridge?.onUiLanguageChanged((locale) => {
  const inputValue = elements.inputLanguage.value;
  const outputValue = elements.outputLanguage.value;
  const captionValues = [elements.captionLanguage1.value, elements.captionLanguage2.value];
  applyUiLanguage(locale);
  elements.inputLanguage.replaceChildren(...INPUT_LANGUAGES.map(({ code }) => new Option(languageLabel(code), code)));
  elements.outputLanguage.replaceChildren(...OUTPUT_LANGUAGES.map(({ code }) => new Option(languageLabel(code), code)));
  elements.inputLanguage.value = inputValue;
  elements.outputLanguage.value = outputValue;
  refreshCaptionOptions(...captionValues);
  updateLanguageLabels();
  updateModeUI();
  updateOutputDevices().catch(() => {});
});

elements.selectSourceButton.addEventListener("click", () => openSourcePicker());
elements.refreshSourcesButton.addEventListener("click", () => Promise.all([loadMicrophones(), loadAudioApps()]));
elements.closeSourcesButton.addEventListener("click", () => elements.sourcePicker.classList.add("mode-hidden"));
elements.selectWindowSourceButton.addEventListener("click", () => selectWindowSource().catch((error) => { setStatus("error", "音声選択エラー"); setMessage(error?.message || "音声を選択できませんでした。", "error"); }));
elements.selectMediaFileButton.addEventListener("click", () => elements.mediaFileInput.click());
elements.mediaFileInput.addEventListener("change", () => {
  const [file] = elements.mediaFileInput.files || [];
  elements.mediaFileInput.value = "";
  selectMediaFile(file).catch((error) => { setStatus("error", "音声選択エラー"); setMessage(error?.message || "音声・動画ファイルを選択できませんでした。", "error"); });
});
elements.startButton.addEventListener("click", startTranslation); elements.stopButton.addEventListener("click", () => stopAll(true));
elements.originalVolume.addEventListener("input", updateVolumes); elements.translatedVolume.addEventListener("input", updateVolumes);
elements.originalMute.addEventListener("click", () => { elements.originalMute.setAttribute("aria-pressed", String(!pressed(elements.originalMute))); updateVolumes(); });
elements.translatedMute.addEventListener("click", () => { elements.translatedMute.setAttribute("aria-pressed", String(!pressed(elements.translatedMute))); updateVolumes(); });
elements.originalOutput.addEventListener("change", () => setSink(elements.originalAudio, elements.originalOutput.value)); elements.translatedOutput.addEventListener("change", () => setSink(elements.translatedAudio, elements.translatedOutput.value));
elements.outputMode.addEventListener("change", () => switchOutputMode().catch((error) => failSafe(error?.message || "利用方法を切り替えられませんでした。")));
elements.inputLanguage.addEventListener("change", () => changeInputLanguage().catch((error) => failSafe(error?.message || "入力言語を切り替えられませんでした。")));
elements.outputLanguage.addEventListener("change", () => changeOutputLanguage().catch((error) => failSafe(error?.message || "通訳言語を切り替えられませんでした。")));
elements.captionLanguage1.addEventListener("change", () => changeCaptionLanguage().catch((error) => failSafe(error?.message || "字幕言語を切り替えられませんでした。")));
elements.captionLanguage2.addEventListener("change", () => changeCaptionLanguage().catch((error) => failSafe(error?.message || "字幕言語を切り替えられませんでした。")));
for (const element of [elements.captionFontSize1, elements.captionFontSize2, elements.captionRows1, elements.captionRows2, elements.captionTransparent]) element.addEventListener("input", updateCaptionSettings);
elements.openCaptionsButton.addEventListener("click", () => { state.captionWindowRequested = true; bridge.openCaptions(); });
elements.closeCaptionsButton.addEventListener("click", () => { state.captionWindowRequested = false; bridge.hideCaptions(); });
elements.captionAlwaysOnTop.addEventListener("change", () => bridge.setCaptionsAlwaysOnTop(elements.captionAlwaysOnTop.checked));
elements.exportCaptionsButton.addEventListener("click", openExportDialog);
elements.exportScope.addEventListener("change", updateExportLayoutControl);
elements.saveTranscriptButton.addEventListener("click", saveTranscript);
window.addEventListener("beforeunload", () => { commitUsage(); state.peers.forEach(({ peer }) => peer.close()); state.captureStream?.getTracks().forEach((track) => track.stop()); releaseMediaPlayback(); });

initialize();
