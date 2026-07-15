import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  Mic,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api, ApiError, formatTime, Wallet } from "./api";

type Locale = "ja" | "en" | "zh-CN";
const ui = {
  ja: {
    title: "リアルタイム音声通訳",
    remain: "残り",
    input: "入力言語",
    output: "出力言語",
    mic: "入力マイク",
    enable: "マイクを有効化",
    test: "出力音量テスト",
    mute: "ミュート",
    unmute: "ミュート解除",
    start: "通訳を開始",
    stop: "通訳を終了",
    pause: "一時停止",
    resume: "再開",
    stopping: "終了処理中…",
    idle: "○ 待機中",
    live: "● 通訳中 — 話し続けてください",
    paused: "Ⅱ 一時停止中 — 時間は消費されません",
    headphones: "イヤホン推奨",
    same: "入力言語と出力言語を別にしてください。",
    empty: "通訳時間がありません。",
    closed: "通訳接続が終了しました。",
    reconnecting: "接続が切れました。再接続しています…",
    used: "今回の利用時間",
    continueTitle: "通訳を続けますか？",
    continueText: "まもなく10分です。操作がなければ自動的に通訳を終了します。",
    continueButton: "通訳を続ける",
    endButton: "今すぐ終了",
    autoStop: "安全のため、10分で通訳を自動終了しました。",
    secondsLeft: "自動終了まで",
    glossary: "固有名詞・専門用語（任意）",
    glossaryHelp:
      "1行に1つ「話す言葉 = 通訳後の言葉」で入力します。入力しただけでは適用されません。",
    glossaryExample: "例：御言葉 = the Word of God\nShalomWorks = ShalomWorks",
    glossaryInvalid:
      "各行を「話す言葉 = 通訳後の言葉」の形で入力してください（最大20件）。",
    glossaryActive: "カスタム用語を適用中（通常Realtimeモデル）",
    glossaryEnable: "カスタム用語を適用",
    glossaryDisable: "カスタム用語の適用を解除",
    glossaryRequired: "カスタム用語を1件以上、正しい形式で入力してください。",
  },
  en: {
    title: "Live voice interpretation",
    remain: "Remaining",
    input: "Input language",
    output: "Output language",
    mic: "Input microphone",
    enable: "Enable microphone",
    test: "Test output volume",
    mute: "Mute",
    unmute: "Unmute",
    start: "Start interpreting",
    stop: "Stop interpreting",
    pause: "Pause",
    resume: "Resume",
    stopping: "Stopping…",
    idle: "○ Ready",
    live: "● Live — keep speaking",
    paused: "Ⅱ Paused — no time is being used",
    headphones: "Headphones recommended",
    same: "Choose different input and output languages.",
    empty: "No interpretation time remains.",
    closed: "The interpretation connection ended.",
    reconnecting: "Connection lost. Reconnecting…",
    used: "This session",
    continueTitle: "Continue interpreting?",
    continueText:
      "You are approaching 10 minutes. Interpretation will stop automatically if there is no response.",
    continueButton: "Continue interpreting",
    endButton: "Stop now",
    autoStop:
      "Interpretation stopped automatically after 10 minutes for safety.",
    secondsLeft: "Automatic stop in",
    glossary: "Names and terminology (optional)",
    glossaryHelp:
      "Enter one pair per line as “spoken term = interpreted term”. Terms are not applied until you enable them.",
    glossaryExample:
      "Example: 御言葉 = the Word of God\nShalomWorks = ShalomWorks",
    glossaryInvalid:
      "Use “spoken term = interpreted term” on each line (maximum 20).",
    glossaryActive: "Custom terms active (standard Realtime model)",
    glossaryEnable: "Apply custom terms",
    glossaryDisable: "Stop applying custom terms",
    glossaryRequired: "Enter at least one valid custom term.",
  },
  "zh-CN": {
    title: "实时语音口译",
    remain: "剩余",
    input: "输入语言",
    output: "输出语言",
    mic: "输入麦克风",
    enable: "启用麦克风",
    test: "测试输出音量",
    mute: "静音",
    unmute: "取消静音",
    start: "开始口译",
    stop: "结束口译",
    pause: "暂停",
    resume: "继续",
    stopping: "正在结束…",
    idle: "○ 待机",
    live: "● 口译中 — 请继续说话",
    paused: "Ⅱ 已暂停 — 不会扣除时间",
    headphones: "建议使用耳机",
    same: "请选择不同的输入和输出语言。",
    empty: "没有剩余口译时间。",
    closed: "口译连接已结束。",
    reconnecting: "连接中断，正在重新连接…",
    used: "本次使用",
    continueTitle: "要继续口译吗？",
    continueText: "即将达到10分钟。如无操作，口译将自动结束。",
    continueButton: "继续口译",
    endButton: "立即结束",
    autoStop: "为防止忘记关闭，口译已在10分钟时自动结束。",
    secondsLeft: "自动结束还剩",
    glossary: "专有名词和术语（可选）",
    glossaryHelp: "每行输入一组“讲话用词 = 口译用词”。仅填写不会自动启用。",
    glossaryExample: "例：御言葉 = the Word of God\nShalomWorks = ShalomWorks",
    glossaryInvalid:
      "请按“讲话用词 = 口译用词”格式填写，每行一组（最多20组）。",
    glossaryActive: "正在应用自定义术语（标准 Realtime 模型）",
    glossaryEnable: "应用自定义术语",
    glossaryDisable: "停止应用自定义术语",
    glossaryRequired: "请至少输入一组格式正确的自定义术语。",
  },
} as const;
const languages = [
  ["ja", "日本語"],
  ["en", "English"],
  ["zh", "中文"],
  ["ko", "한국어"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["it", "Italiano"],
  ["ru", "Русский"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["th", "ไทย"],
  ["vi", "Tiếng Việt"],
];
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

type GlossaryEntry = { source: string; translation: string };
function parseGlossary(value: string): GlossaryEntry[] | null {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 20) return null;
  const entries: GlossaryEntry[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*(?:=|→|->|\t)\s*(.+)$/);
    if (!match) return null;
    const source = match[1].trim();
    const translation = match[2].trim();
    if (
      !source ||
      !translation ||
      source.length > 80 ||
      translation.length > 80
    )
      return null;
    entries.push({ source, translation });
  }
  return entries;
}

export function Interpreter({
  wallet,
  csrf,
  onBalance,
  locale,
  terminologyPreset,
}: {
  wallet: Wallet;
  csrf: string;
  onBalance: (seconds: number) => void;
  locale: Locale;
  terminologyPreset: {
    source: string;
    target: string;
    terms: GlossaryEntry[];
  } | null;
}) {
  const t = ui[locale];
  const [source, setSource] = useState("ja");
  const [target, setTarget] = useState("en");
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "paused" | "stopping"
  >("idle");
  const [level, setLevel] = useState(0);
  const [remaining, setRemaining] = useState(
    Number(wallet.trial_seconds) + Number(wallet.paid_seconds),
  );
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [continuePrompt, setContinuePrompt] = useState(false);
  const [glossaryText, setGlossaryText] = useState("");
  const [useTerminologyMode, setUseTerminologyMode] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const processor = useRef<ScriptProcessorNode | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const analyserFrame = useRef<number | null>(null);
  const playCursor = useRef(0);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const timer = useRef<number | null>(null);
  const userStopped = useRef(false);
  const pausedRef = useRef(false);
  const reconnectCount = useRef(0);
  const remainingRef = useRef(remaining);
  const reconnectTimer = useRef<number | null>(null);
  const autoPrepareStarted = useRef(false);
  const elapsedRef = useRef(0);
  const warningAt = useRef(9 * 60);
  const stopAt = useRef(10 * 60);
  useEffect(() => {
    setRemaining(Number(wallet.trial_seconds) + Number(wallet.paid_seconds));
  }, [wallet]);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    if (!terminologyPreset) return;
    setSource(terminologyPreset.source);
    setTarget(terminologyPreset.target);
    setGlossaryText(
      terminologyPreset.terms
        .slice(0, 20)
        .map((entry) => `${entry.source} = ${entry.translation}`)
        .join("\n"),
    );
  }, [terminologyPreset]);
  useEffect(() => {
    if (autoPrepareStarted.current) return;
    autoPrepareStarted.current = true;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((permission) => {
        if (permission.state === "granted") return prepare();
      })
      .catch(() => {
        // Permission API support varies; the explicit enable button remains available.
      });
  }, []);
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
    const list = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "audioinput",
    );
    setDevices(list);
    if (!deviceId && media.getAudioTracks()[0]?.getSettings().deviceId)
      setDeviceId(media.getAudioTracks()[0].getSettings().deviceId || "");
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
      setLevel(
        Math.min(
          100,
          Math.round(values.reduce((a, b) => a + b, 0) / values.length / 1.25),
        ),
      );
      analyserFrame.current = requestAnimationFrame(draw);
    };
    draw();
  }
  function play(delta: string) {
    const ctx = context.current;
    if (!ctx) return;
    const raw = atob(delta);
    const input = new Int16Array(raw.length / 2);
    for (let i = 0; i < input.length; i++)
      input[i] =
        ((raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8)) << 16) >>
        16;
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
  async function start() {
    setMessage("");
    userStopped.current = false;
    if (source === target) {
      setMessage(t.same);
      return;
    }
    if (remaining <= 0) {
      setMessage(t.empty);
      return;
    }
    const parsedGlossary = parseGlossary(glossaryText);
    if (useTerminologyMode && parsedGlossary === null) {
      setMessage(t.glossaryInvalid);
      return;
    }
    if (useTerminologyMode && parsedGlossary?.length === 0) {
      setMessage(t.glossaryRequired);
      return;
    }
    const glossary = useTerminologyMode ? parsedGlossary || [] : [];
    try {
      await prepare();
      reconnectCount.current = 0;
      setElapsed(0);
      elapsedRef.current = 0;
      warningAt.current = 9 * 60;
      stopAt.current = 10 * 60;
      setContinuePrompt(false);
      setStatus("connecting");
      await connect(glossary);
    } catch (error) {
      finishSession();
      setMessage(
        error instanceof ApiError && error.code === "BALANCE_EMPTY"
          ? t.empty
          : error instanceof Error
            ? error.message
            : t.closed,
      );
    }
  }
  async function connect(glossary = parseGlossary(glossaryText) || []) {
    const authorization = await api<{
      gateway_url: string;
      access_token: string;
    }>(
      "interpreter/authorize.php",
      {
        method: "POST",
        body: JSON.stringify({
          source_language: source,
          target_language: target,
          glossary,
          use_terminology_mode: useTerminologyMode,
        }),
      },
      csrf,
    );
    const ws = new WebSocket(
      authorization.gateway_url.replace(/^http/, "ws") + "/translate",
    );
    socket.current = ws;
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: "authenticate",
          access_token: authorization.access_token,
        }),
      );
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "ready") {
        setStatus("live");
        setMessage("");
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = window.setInterval(() => {
          if (!pausedRef.current) {
            const next = elapsedRef.current + 1;
            elapsedRef.current = next;
            setElapsed(next);
            if (next === warningAt.current) setContinuePrompt(true);
            if (next >= stopAt.current) {
              setContinuePrompt(false);
              setMessage(t.autoStop);
              stop();
            }
          }
        }, 1000);
        const ctx = context.current!;
        const src = ctx.createMediaStreamSource(stream.current!);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processor.current = proc;
        proc.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !pausedRef.current)
            ws.send(
              JSON.stringify({
                type: "audio",
                audio: encodePcm16(
                  e.inputBuffer.getChannelData(0),
                  ctx.sampleRate,
                ),
              }),
            );
        };
        src.connect(proc);
        proc.connect(ctx.destination);
      }
      if (data.type === "audio") play(data.delta);
      if (data.type === "paused") {
        pausedRef.current = true;
        setStatus("paused");
      }
      if (data.type === "resumed") {
        pausedRef.current = false;
        setStatus("live");
      }
      if (data.type === "billing") {
        setRemaining(data.remaining_seconds);
        onBalance(data.remaining_seconds);
      }
    };
    ws.onclose = (event) => {
      detachConnection();
      if (event.reason === "balance_exhausted") {
        finishSession();
        setMessage(t.empty);
      } else if (
        !userStopped.current &&
        event.code !== 1000 &&
        remainingRef.current > 0
      )
        retryConnection(800);
      else {
        finishSession();
        if (!userStopped.current && event.code !== 1000) setMessage(t.closed);
      }
    };
  }
  function retryConnection(delay: number) {
    if (userStopped.current || reconnectCount.current >= 2) {
      finishSession();
      if (!userStopped.current) setMessage(t.closed);
      return;
    }
    reconnectCount.current += 1;
    setStatus("connecting");
    setMessage(t.reconnecting);
    reconnectTimer.current = window.setTimeout(async () => {
      if (userStopped.current) return;
      try {
        await connect();
      } catch {
        retryConnection(1200);
      }
    }, delay);
  }
  function detachConnection() {
    processor.current?.disconnect();
    processor.current = null;
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    socket.current = null;
  }
  function finishSession() {
    pausedRef.current = false;
    setContinuePrompt(false);
    setStatus("idle");
    detachConnection();
  }
  function stop() {
    userStopped.current = true;
    setContinuePrompt(false);
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: "stop" }));
      setStatus("stopping");
    } else {
      socket.current?.close();
      finishSession();
    }
  }
  function togglePause() {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: status === "paused" ? "resume" : "pause" }));
  }
  function continueInterpretation() {
    warningAt.current = elapsedRef.current + 9 * 60;
    stopAt.current = elapsedRef.current + 10 * 60;
    setContinuePrompt(false);
  }
  function shutdownMedia() {
    if (analyserFrame.current !== null)
      cancelAnimationFrame(analyserFrame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    context.current?.close();
    stream.current = null;
    context.current = null;
    analyserFrame.current = null;
    setLevel(0);
  }
  function shutdown() {
    userStopped.current = true;
    if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    socket.current?.close();
    processor.current?.disconnect();
    if (timer.current !== null) clearInterval(timer.current);
    shutdownMedia();
  }
  async function testSound() {
    await prepare();
    const ctx = context.current!;
    const response = await fetch("/audio/output-test.mp3", {
      cache: "force-cache",
    });
    if (!response.ok) throw new Error(t.closed);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = mutedRef.current ? 0 : volumeRef.current;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }
  async function changeDevice(value: string) {
    setDeviceId(value);
    if (stream.current) {
      shutdownMedia();
      setTimeout(
        () => prepare(true, value).catch(() => setMessage(t.closed)),
        0,
      );
    }
  }
  return (
    <section className="interpreter-app" id="live-interpreter">
      <div className="app-heading">
        <div>
          <p className="section-kicker">LIVE INTERPRETER</p>
          <h2>{t.title}</h2>
        </div>
        <div className="wallet-pill">
          {t.remain}
          <strong>{formatTime(remaining)}</strong>
          <small>
            {t.used} {formatTime(elapsed)}
          </small>
        </div>
      </div>
      <div className="language-row app-languages">
        <label>
          {t.input}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={status !== "idle"}
          >
            {languages.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <span className="swap">→</span>
        <label>
          {t.output}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={status !== "idle"}
          >
            {languages.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="device-select">
        {t.mic}
        <select
          value={deviceId}
          onChange={(e) => changeDevice(e.target.value)}
          disabled={status !== "idle"}
        >
          <option value="">Default</option>
          {devices.map((device, index) => (
            <option value={device.deviceId} key={device.deviceId}>
              {device.label || `Microphone ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label className="glossary-field">
        <span>{t.glossary}</span>
        <textarea
          value={glossaryText}
          onChange={(e) => setGlossaryText(e.target.value)}
          placeholder={t.glossaryExample}
          rows={3}
          disabled={status !== "idle"}
        />
        <small>{t.glossaryHelp}</small>
        <button
          type="button"
          className={
            useTerminologyMode
              ? "terminology-toggle active"
              : "terminology-toggle"
          }
          onClick={() => setUseTerminologyMode((enabled) => !enabled)}
          disabled={
            status !== "idle" ||
            parseGlossary(glossaryText) === null ||
            (parseGlossary(glossaryText)?.length ?? 0) === 0
          }
        >
          {useTerminologyMode ? t.glossaryDisable : t.glossaryEnable}
        </button>
        {useTerminologyMode && (
          <strong>
            {t.glossaryActive} · {parseGlossary(glossaryText)?.length ?? 0}
          </strong>
        )}
      </label>
      <div className="meter">
        <div style={{ width: `${level}%` }} />
        <span>
          <Mic size={16} /> INPUT {level}%
        </span>
      </div>
      <div className="audio-controls">
        <button className="secondary" onClick={() => prepare()}>
          <Mic size={17} />
          {t.enable}
        </button>
        <button className="secondary" onClick={testSound}>
          <Volume2 size={17} />
          {t.test}
        </button>
        <button
          className="secondary"
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{" "}
          {muted ? t.unmute : t.mute}
        </button>
        <label>
          <Volume2 size={16} />
          <input
            type="range"
            min="0"
            max="1"
            step=".05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
      {status === "idle" ? (
        <button
          className="primary interpreter-start"
          onClick={start}
          disabled={remaining <= 0}
        >
          <Mic />
          {t.start}
        </button>
      ) : (
        <div className="live-actions">
          {(status === "live" || status === "paused") && (
            <button className="secondary" onClick={togglePause}>
              {status === "paused" ? <Play /> : <Pause />}
              {status === "paused" ? t.resume : t.pause}
            </button>
          )}
          <button
            className="stop-button"
            onClick={stop}
            disabled={status === "stopping"}
          >
            <Square />
            {status === "stopping" ? t.stopping : t.stop}
          </button>
        </div>
      )}
      <p className={`status-line ${status}`}>
        {status === "live" ? t.live : status === "paused" ? t.paused : t.idle}
        <span>
          <Headphones size={15} />
          {t.headphones}
        </span>
      </p>
      {message && <p className="form-message">{message}</p>}
      {continuePrompt && (
        <div className="continue-overlay" role="dialog" aria-modal="true">
          <div className="continue-dialog">
            <h3>{t.continueTitle}</h3>
            <p>{t.continueText}</p>
            <strong>
              {t.secondsLeft} {Math.max(0, stopAt.current - elapsed)}s
            </strong>
            <div>
              <button className="primary" onClick={continueInterpretation}>
                {t.continueButton}
              </button>
              <button className="stop-button" onClick={stop}>
                {t.endButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
