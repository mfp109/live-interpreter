import { useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Mic, Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { api, ApiError, formatCredits, Wallet } from "./api";
import { Locale } from "./locales";

type Mode = "both" | "audio" | "captions";
type Status = "idle" | "connecting" | "live" | "paused" | "stopping";

const languages = [
  ["ja", "日本語"], ["en", "English"], ["zh", "中文"], ["ko", "한국어"],
  ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"],
  ["it", "Italiano"], ["ru", "Русский"], ["ar", "العربية"], ["hi", "हिन्दी"],
  ["id", "Bahasa Indonesia"], ["th", "ไทย"], ["vi", "Tiếng Việt"],
] as const;

const EN = {
  title: "Live interpretation",
  mode: "Mode",
  both: "Audio + captions",
  audio: "Audio only",
  captions: "Captions only",
  remain: "LI Credit balance",
  used: "Used this session",
  rate: "Credits per second",
  input: "Input language",
  output: "Interpretation language",
  caption1: "Caption language 1",
  caption2: "Caption language 2",
  source: "Source language",
  none: "None",
  mic: "Input microphone",
  defaultMic: "Default microphone",
  enable: "Enable microphone",
  test: "Test output volume",
  mute: "Mute",
  unmute: "Unmute",
  start: "Start",
  stop: "Stop",
  pause: "Pause",
  resume: "Resume",
  idle: "○ Ready",
  live: "● Live — keep speaking",
  paused: "Ⅱ Paused — no credits are used",
  connecting: "Connecting…",
  stopping: "Stopping…",
  headphones: "Headphones recommended",
  same: "Choose different input and interpretation languages.",
  captionRequired: "Choose at least one caption language.",
  duplicateCaption: "Choose two different caption languages.",
  empty: "No credits remain.",
  closed: "The connection ended.",
  reconnecting: "Connection lost. Reconnecting…",
  captionWaiting: "Captions will appear here when you speak.",
  continueTitle: "Continue interpreting?",
  continueText: "The session will stop automatically if there is no response.",
  continueButton: "Continue",
  endButton: "Stop now",
  autoStop: "The session stopped automatically after 10 minutes.",
};

type Strings = typeof EN;
const overrides: Partial<Record<Locale, Partial<Strings>>> = {
  ja: {
    title: "リアルタイム通訳", mode: "利用方法", both: "音声＋字幕", audio: "音声のみ", captions: "字幕のみ",
    remain: "LIクレジット残高", used: "今回の消費", rate: "1秒あたりのクレジット", input: "入力言語", output: "通訳言語",
    caption1: "字幕言語 1", caption2: "字幕言語 2", source: "原語", none: "なし", mic: "入力マイク", defaultMic: "標準マイク",
    enable: "マイクを有効化", test: "出力音量テスト", mute: "ミュート", unmute: "ミュート解除", start: "開始", stop: "終了",
    pause: "一時停止", resume: "再開", idle: "○ 待機中", live: "● 実行中 — 話し続けてください", paused: "Ⅱ 一時停止中 — クレジットは減りません",
    connecting: "接続中…", stopping: "終了処理中…", headphones: "イヤホン推奨", same: "入力言語と通訳言語を別にしてください。",
    captionRequired: "字幕言語を1つ以上選んでください。", duplicateCaption: "字幕言語1・2は別の言語を選んでください。", empty: "クレジット残高がありません。",
    closed: "接続が終了しました。", reconnecting: "接続が切れました。再接続しています…", captionWaiting: "話すとここに字幕が表示されます。",
    continueTitle: "続けますか？", continueText: "操作がなければ自動的に終了します。", continueButton: "続ける", endButton: "今すぐ終了", autoStop: "安全のため10分で自動終了しました。",
  },
  "zh-CN": {
    title: "实时口译", mode: "使用方式", both: "语音＋字幕", audio: "仅语音", captions: "仅字幕", remain: "LI积分余额", used: "本次消耗", rate: "每秒积分",
    input: "输入语言", output: "口译语言", caption1: "字幕语言1", caption2: "字幕语言2", source: "原语言", none: "无", mic: "输入麦克风", defaultMic: "默认麦克风",
    enable: "启用麦克风", test: "测试音量", mute: "静音", unmute: "取消静音", start: "开始", stop: "结束", pause: "暂停", resume: "继续", idle: "○ 待机",
    live: "● 进行中 — 请继续说话", paused: "Ⅱ 已暂停 — 不扣积分", connecting: "连接中…", stopping: "正在结束…", headphones: "建议使用耳机",
    same: "请选择不同的输入和口译语言。", captionRequired: "请至少选择一种字幕语言。", duplicateCaption: "请选择两种不同的字幕语言。", empty: "积分余额不足。",
    closed: "连接已结束。", reconnecting: "连接中断，正在重新连接…", captionWaiting: "说话后字幕会显示在这里。", continueTitle: "继续吗？", continueText: "如无操作将自动结束。",
    continueButton: "继续", endButton: "立即结束", autoStop: "已在10分钟后自动结束。",
  },
  es: { title: "Interpretación en tiempo real", mode: "Modo", both: "Audio + subtítulos", audio: "Solo audio", captions: "Solo subtítulos", input: "Idioma de entrada", output: "Idioma de interpretación", caption1: "Idioma de subtítulos 1", caption2: "Idioma de subtítulos 2", source: "Idioma original", none: "Ninguno", start: "Iniciar", stop: "Finalizar", pause: "Pausa", resume: "Reanudar", remain: "Saldo de créditos LI" },
  pt: { title: "Interpretação em tempo real", mode: "Modo", both: "Áudio + legendas", audio: "Somente áudio", captions: "Somente legendas", input: "Idioma de entrada", output: "Idioma da interpretação", caption1: "Idioma da legenda 1", caption2: "Idioma da legenda 2", source: "Idioma original", none: "Nenhum", start: "Iniciar", stop: "Encerrar", pause: "Pausar", resume: "Retomar", remain: "Saldo de créditos LI" },
  fr: { title: "Interprétation en temps réel", mode: "Mode", both: "Audio + sous-titres", audio: "Audio uniquement", captions: "Sous-titres uniquement", input: "Langue d’entrée", output: "Langue d’interprétation", caption1: "Langue des sous-titres 1", caption2: "Langue des sous-titres 2", source: "Langue source", none: "Aucun", start: "Démarrer", stop: "Arrêter", pause: "Pause", resume: "Reprendre", remain: "Solde de crédits LI" },
  de: { title: "Live-Dolmetschen", mode: "Modus", both: "Audio + Untertitel", audio: "Nur Audio", captions: "Nur Untertitel", input: "Eingabesprache", output: "Dolmetschsprache", caption1: "Untertitelsprache 1", caption2: "Untertitelsprache 2", source: "Originalsprache", none: "Keine", start: "Starten", stop: "Beenden", pause: "Pause", resume: "Fortsetzen", remain: "LI-Guthaben" },
  ru: { title: "Синхронный перевод", mode: "Режим", both: "Звук + субтитры", audio: "Только звук", captions: "Только субтитры", input: "Язык ввода", output: "Язык перевода", caption1: "Язык субтитров 1", caption2: "Язык субтитров 2", source: "Исходный язык", none: "Нет", start: "Начать", stop: "Остановить", pause: "Пауза", resume: "Продолжить", remain: "Баланс LI-кредитов" },
  ko: { title: "실시간 통역", mode: "사용 방식", both: "음성 + 자막", audio: "음성만", captions: "자막만", input: "입력 언어", output: "통역 언어", caption1: "자막 언어 1", caption2: "자막 언어 2", source: "원어", none: "없음", start: "시작", stop: "종료", pause: "일시정지", resume: "재개", remain: "LI 크레딧 잔액" },
  hi: { title: "लाइव दुभाषिया", mode: "मोड", both: "ऑडियो + उपशीर्षक", audio: "केवल ऑडियो", captions: "केवल उपशीर्षक", input: "इनपुट भाषा", output: "अनुवाद भाषा", caption1: "उपशीर्षक भाषा 1", caption2: "उपशीर्षक भाषा 2", source: "मूल भाषा", none: "कोई नहीं", start: "शुरू करें", stop: "समाप्त", pause: "रोकें", resume: "जारी रखें", remain: "LI क्रेडिट शेष" },
  id: { title: "Interpretasi langsung", mode: "Mode", both: "Audio + teks", audio: "Audio saja", captions: "Teks saja", input: "Bahasa masukan", output: "Bahasa interpretasi", caption1: "Bahasa teks 1", caption2: "Bahasa teks 2", source: "Bahasa sumber", none: "Tidak ada", start: "Mulai", stop: "Selesai", pause: "Jeda", resume: "Lanjutkan", remain: "Saldo kredit LI" },
  vi: { title: "Phiên dịch trực tiếp", mode: "Chế độ", both: "Âm thanh + phụ đề", audio: "Chỉ âm thanh", captions: "Chỉ phụ đề", input: "Ngôn ngữ đầu vào", output: "Ngôn ngữ phiên dịch", caption1: "Ngôn ngữ phụ đề 1", caption2: "Ngôn ngữ phụ đề 2", source: "Ngôn ngữ gốc", none: "Không", start: "Bắt đầu", stop: "Kết thúc", pause: "Tạm dừng", resume: "Tiếp tục", remain: "Số dư tín dụng LI" },
  it: { title: "Interpretazione in tempo reale", mode: "Modalità", both: "Audio + sottotitoli", audio: "Solo audio", captions: "Solo sottotitoli", input: "Lingua di input", output: "Lingua di interpretazione", caption1: "Lingua sottotitoli 1", caption2: "Lingua sottotitoli 2", source: "Lingua originale", none: "Nessuno", start: "Avvia", stop: "Termina", pause: "Pausa", resume: "Riprendi", remain: "Saldo crediti LI" },
};

function strings(locale: Locale): Strings {
  return { ...EN, ...(overrides[locale] || {}) };
}

function toBase64(bytes: Uint8Array) {
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192)
    value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}

function encodePcm16(samples: Float32Array, inputRate: number) {
  const ratio = inputRate / 24000;
  const output = new Int16Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return toBase64(new Uint8Array(output.buffer));
}

function appendCaption(current: string, delta: string) {
  const next = `${current}${delta}`;
  return next.length > 2200 ? next.slice(-2000).replace(/^\S*\s?/, "") : next;
}

export function Interpreter({
  wallet,
  csrf,
  onBalance,
  locale,
}: {
  wallet: Wallet;
  csrf: string;
  onBalance: (credits: number) => void;
  locale: Locale;
}) {
  const t = strings(locale);
  const [mode, setMode] = useState<Mode>("both");
  const [source, setSource] = useState("ja");
  const [target, setTarget] = useState("en");
  const [caption1, setCaption1] = useState("source");
  const [caption2, setCaption2] = useState("en");
  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [remaining, setRemaining] = useState(Number(wallet.trial_seconds) + Number(wallet.paid_seconds));
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [activeRate, setActiveRate] = useState(0);
  const [captionText, setCaptionText] = useState<Record<string, string>>({});
  const [continuePrompt, setContinuePrompt] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const processor = useRef<ScriptProcessorNode | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const analyserFrame = useRef<number | null>(null);
  const playCursor = useRef(0);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const timer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const userStopped = useRef(false);
  const pausedRef = useRef(false);
  const reconnectCount = useRef(0);
  const remainingRef = useRef(remaining);
  const elapsedRef = useRef(0);
  const activeRateRef = useRef(0);
  const warningAt = useRef(9 * 60);
  const stopAt = useRef(10 * 60);

  const captionLanguages = useMemo(
    () => (mode === "audio" ? [] : [caption1, caption2].filter((value) => value !== "none")),
    [mode, caption1, caption2],
  );
  const plannedRate = useMemo(() => {
    const translations = new Set<string>();
    if (mode !== "captions") translations.add(target);
    for (const language of captionLanguages)
      if (language !== "source" && language !== source) translations.add(language);
    const sourceCaptions = captionLanguages.some((language) => language === "source" || language === source);
    return translations.size * 12 + (sourceCaptions ? 1 : 0);
  }, [mode, target, source, captionLanguages]);

  useEffect(() => setRemaining(Number(wallet.trial_seconds) + Number(wallet.paid_seconds)), [wallet]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { activeRateRef.current = activeRate; }, [activeRate]);
  useEffect(() => () => shutdown(), []);

  async function prepare(force = false, selectedDevice = deviceId) {
    if (stream.current && !force) return;
    if (force) shutdownMedia();
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.current = media;
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === "audioinput");
    setDevices(list);
    if (!deviceId) setDeviceId(media.getAudioTracks()[0]?.getSettings().deviceId || "");
    const ctx = new AudioContext();
    context.current = ctx;
    playCursor.current = ctx.currentTime;
    const src = ctx.createMediaStreamSource(media);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(values);
      setLevel(Math.min(100, Math.round(values.reduce((a, b) => a + b, 0) / values.length / 1.25)));
      analyserFrame.current = requestAnimationFrame(draw);
    };
    draw();
  }

  function playAudio(delta: string) {
    const ctx = context.current;
    if (!ctx) return;
    const raw = atob(delta);
    const input = new Int16Array(raw.length / 2);
    for (let i = 0; i < input.length; i++)
      input[i] = ((raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8)) << 16) >> 16;
    const buffer = ctx.createBuffer(1, input.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) channel[i] = input[i] / 32768;
    const node = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = mutedRef.current ? 0 : volumeRef.current;
    node.buffer = buffer;
    node.connect(gain).connect(ctx.destination);
    playCursor.current = Math.max(playCursor.current, ctx.currentTime + 0.03);
    node.start(playCursor.current);
    playCursor.current += buffer.duration;
  }

  function validationError() {
    if (mode !== "captions" && source === target) return t.same;
    if (mode !== "audio" && captionLanguages.length === 0) return t.captionRequired;
    if (caption1 !== "none" && caption1 === caption2) return t.duplicateCaption;
    return "";
  }

  async function start() {
    setMessage("");
    const error = validationError();
    if (error) return setMessage(error);
    if (remaining < plannedRate) return setMessage(t.empty);
    try {
      await prepare();
      userStopped.current = false;
      reconnectCount.current = 0;
      setCaptionText({});
      setElapsed(0);
      elapsedRef.current = 0;
      warningAt.current = 9 * 60;
      stopAt.current = 10 * 60;
      setContinuePrompt(false);
      setStatus("connecting");
      await connect();
    } catch (errorValue) {
      finishSession();
      setMessage(errorValue instanceof ApiError && errorValue.code === "BALANCE_EMPTY" ? t.empty : errorValue instanceof Error ? errorValue.message : t.closed);
    }
  }

  async function connect() {
    const authorization = await api<{ gateway_url: string; access_token: string; credits_per_second: number }>(
      "interpreter/authorize.php",
      {
        method: "POST",
        body: JSON.stringify({
          source_language: source,
          target_language: mode === "captions" ? null : target,
          caption_languages: captionLanguages,
          mode,
        }),
      },
      csrf,
    );
    setActiveRate(authorization.credits_per_second);
    activeRateRef.current = authorization.credits_per_second;
    const ws = new WebSocket(authorization.gateway_url.replace(/^http/, "ws") + "/translate");
    socket.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "authenticate", access_token: authorization.access_token }));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "ready") {
        const rate = Number(data.credits_per_second) || authorization.credits_per_second;
        setActiveRate(rate);
        activeRateRef.current = rate;
        setStatus("live");
        setMessage("");
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = window.setInterval(() => {
          if (pausedRef.current) return;
          const next = elapsedRef.current + 1;
          elapsedRef.current = next;
          setElapsed(next);
          setRemaining((credits) => Math.max(0, credits - activeRateRef.current));
          if (next === warningAt.current) setContinuePrompt(true);
          if (next >= stopAt.current) {
            setContinuePrompt(false);
            setMessage(t.autoStop);
            stop();
          }
        }, 1000);
        const ctx = context.current!;
        const src = ctx.createMediaStreamSource(stream.current!);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processor.current = proc;
        proc.onaudioprocess = (audioEvent) => {
          if (ws.readyState === WebSocket.OPEN && !pausedRef.current)
            ws.send(JSON.stringify({ type: "audio", audio: encodePcm16(audioEvent.inputBuffer.getChannelData(0), ctx.sampleRate) }));
        };
        src.connect(proc);
        proc.connect(ctx.destination);
      }
      if (data.type === "audio") playAudio(data.delta);
      if (data.type === "caption_delta" && data.caption_key && data.delta)
        setCaptionText((current) => ({ ...current, [data.caption_key]: appendCaption(current[data.caption_key] || "", String(data.delta)) }));
      if (data.type === "caption_completed" && data.caption_key && data.transcript)
        setCaptionText((current) => {
          const existing = current[data.caption_key] || "";
          const transcript = String(data.transcript).trim();
          return existing.endsWith(transcript) ? current : { ...current, [data.caption_key]: appendCaption(existing, `${transcript} `) };
        });
      if (data.type === "paused") { pausedRef.current = true; setStatus("paused"); }
      if (data.type === "resumed") { pausedRef.current = false; setStatus("live"); }
      if (data.type === "billing") { setRemaining(data.remaining_seconds); onBalance(data.remaining_seconds); }
    };
    ws.onclose = (event) => {
      detachConnection();
      if (event.reason === "balance_exhausted") { finishSession(); setMessage(t.empty); }
      else if (!userStopped.current && event.code !== 1000 && remainingRef.current > activeRateRef.current) retryConnection(800);
      else { finishSession(); if (!userStopped.current && event.code !== 1000) setMessage(t.closed); }
    };
  }

  function retryConnection(delay: number) {
    if (userStopped.current || reconnectCount.current >= 2) { finishSession(); if (!userStopped.current) setMessage(t.closed); return; }
    reconnectCount.current += 1;
    setStatus("connecting");
    setMessage(t.reconnecting);
    reconnectTimer.current = window.setTimeout(() => connect().catch(() => retryConnection(1200)), delay);
  }

  function detachConnection() {
    processor.current?.disconnect();
    processor.current = null;
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    socket.current = null;
  }
  function finishSession() { pausedRef.current = false; setContinuePrompt(false); setStatus("idle"); detachConnection(); }
  function stop() {
    userStopped.current = true;
    setContinuePrompt(false);
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    if (socket.current?.readyState === WebSocket.OPEN) { socket.current.send(JSON.stringify({ type: "stop" })); setStatus("stopping"); }
    else { socket.current?.close(); finishSession(); }
  }
  function togglePause() { socket.current?.send(JSON.stringify({ type: status === "paused" ? "resume" : "pause" })); }
  function continueInterpretation() { warningAt.current = elapsedRef.current + 9 * 60; stopAt.current = elapsedRef.current + 10 * 60; setContinuePrompt(false); }
  function shutdownMedia() {
    if (analyserFrame.current !== null) cancelAnimationFrame(analyserFrame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    context.current?.close();
    stream.current = null; context.current = null; analyserFrame.current = null; setLevel(0);
  }
  function shutdown() {
    userStopped.current = true;
    if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    socket.current?.close(); processor.current?.disconnect();
    if (timer.current !== null) clearInterval(timer.current);
    shutdownMedia();
  }
  async function testSound() {
    await prepare();
    const ctx = context.current!;
    const response = await fetch("/audio/output-test.mp3", { cache: "force-cache" });
    if (!response.ok) throw new Error(t.closed);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const sourceNode = ctx.createBufferSource();
    const gain = ctx.createGain(); gain.gain.value = mutedRef.current ? 0 : volumeRef.current;
    sourceNode.buffer = buffer; sourceNode.connect(gain).connect(ctx.destination); sourceNode.start();
  }
  async function changeDevice(value: string) {
    setDeviceId(value);
    if (stream.current) { shutdownMedia(); setTimeout(() => prepare(true, value).catch(() => setMessage(t.closed)), 0); }
  }
  const languageLabel = (code: string) => languages.find(([value]) => value === code)?.[1] || code;
  const statusText = status === "live" ? t.live : status === "paused" ? t.paused : status === "connecting" ? t.connecting : status === "stopping" ? t.stopping : t.idle;
  const captionOptions = (value: string) => (
    <>
      <option value="none">{t.none}</option>
      <option value="source">{t.source}</option>
      {languages.filter(([code]) => code !== source).map(([code, label]) => <option value={code} key={`${value}-${code}`}>{label}</option>)}
    </>
  );

  return (
    <section className="interpreter-app" id="live-interpreter">
      <div className="app-heading">
        <div><p className="section-kicker">LIVE INTERPRETER</p><h2>{t.title}</h2></div>
        <div className="wallet-pill">{t.remain}<strong>{formatCredits(remaining)}</strong><small>{t.used} {formatCredits(elapsed * activeRate)}</small></div>
      </div>
      <div className="session-config-grid">
        <label>{t.mode}<select value={mode} onChange={(e) => setMode(e.target.value as Mode)} disabled={status !== "idle"}><option value="both">{t.both}</option><option value="audio">{t.audio}</option><option value="captions">{t.captions}</option></select></label>
        <label>{t.input}<select value={source} onChange={(e) => setSource(e.target.value)} disabled={status !== "idle"}>{languages.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label>
        {mode !== "captions" && <label>{t.output}<select value={target} onChange={(e) => setTarget(e.target.value)} disabled={status !== "idle"}>{languages.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label>}
        {mode !== "audio" && <><label>{t.caption1}<select value={caption1} onChange={(e) => setCaption1(e.target.value)} disabled={status !== "idle"}>{captionOptions("one")}</select></label><label>{t.caption2}<select value={caption2} onChange={(e) => setCaption2(e.target.value)} disabled={status !== "idle"}>{captionOptions("two")}</select></label></>}
      </div>
      <div className="rate-summary"><span>{t.rate}</span><strong>{formatCredits(plannedRate)}</strong></div>
      <label className="device-select">{t.mic}<select value={deviceId} onChange={(e) => changeDevice(e.target.value)} disabled={status !== "idle"}><option value="">{t.defaultMic}</option>{devices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>
      {mode !== "audio" && <div className="dual-caption-screen" aria-live="polite">{[caption1, caption2].filter((code) => code !== "none").map((code, index) => { const key = code === source ? "source" : code; return <article key={`${code}-${index}`}><small>{index === 0 ? t.caption1 : t.caption2} · {code === "source" ? languageLabel(source) : languageLabel(code)}</small><p className={captionText[key] ? "" : "placeholder"}>{captionText[key] || t.captionWaiting}</p></article>; })}</div>}
      <div className="meter"><div style={{ width: `${level}%` }} /><span><Mic size={16} /> INPUT {level}%</span></div>
      <div className="audio-controls">
        <button className="secondary" onClick={() => prepare()}><Mic size={17} />{t.enable}</button>
        {mode !== "captions" && <><button className="secondary" onClick={() => testSound()}><Volume2 size={17} />{t.test}</button><button className="secondary" onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{muted ? t.unmute : t.mute}</button><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="volume" /></>}
      </div>
      <div className={`live-status ${status}`}><span>{statusText}</span>{mode !== "captions" && <small><Headphones size={14} /> {t.headphones}</small>}</div>
      {message && <p className="form-message">{message}</p>}
      <div className="interpreter-actions">{status === "idle" ? <button className="primary" onClick={start}><Play size={18} />{t.start}</button> : <><button className="secondary" onClick={togglePause} disabled={status === "connecting" || status === "stopping"}>{status === "paused" ? <Play size={18} /> : <Pause size={18} />}{status === "paused" ? t.resume : t.pause}</button><button className="danger" onClick={stop}><Square size={17} />{t.stop}</button></>}</div>
      {continuePrompt && <div className="continue-prompt"><h3>{t.continueTitle}</h3><p>{t.continueText}</p><div><button className="primary" onClick={continueInterpretation}>{t.continueButton}</button><button className="secondary" onClick={stop}>{t.endButton}</button></div></div>}
    </section>
  );
}
