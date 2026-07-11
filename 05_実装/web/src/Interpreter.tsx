import { useEffect, useRef, useState } from "react";
import { Headphones, Mic, Square, Volume2, VolumeX } from "lucide-react";
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
    stopping: "終了処理中…",
    idle: "○ 待機中",
    live: "● 通訳中 — 話し続けてください",
    headphones: "イヤホン推奨",
    same: "入力言語と出力言語を別にしてください。",
    empty: "通訳時間がありません。",
    closed: "通訳接続が終了しました。",
    used: "今回の利用時間",
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
    stopping: "Stopping…",
    idle: "○ Ready",
    live: "● Live — keep speaking",
    headphones: "Headphones recommended",
    same: "Choose different input and output languages.",
    empty: "No interpretation time remains.",
    closed: "The interpretation connection ended.",
    used: "This session",
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
    stopping: "正在结束…",
    idle: "○ 待机",
    live: "● 口译中 — 请继续说话",
    headphones: "建议使用耳机",
    same: "请选择不同的输入和输出语言。",
    empty: "没有剩余口译时间。",
    closed: "口译连接已结束。",
    used: "本次使用",
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

export function Interpreter({
  wallet,
  csrf,
  onBalance,
  locale,
}: {
  wallet: Wallet;
  csrf: string;
  onBalance: (seconds: number) => void;
  locale: Locale;
}) {
  const t = ui[locale];
  const [source, setSource] = useState("ja");
  const [target, setTarget] = useState("en");
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "stopping"
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
  useEffect(() => {
    setRemaining(Number(wallet.trial_seconds) + Number(wallet.paid_seconds));
  }, [wallet]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
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
    try {
      await prepare();
      setStatus("connecting");
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
          setElapsed(0);
          timer.current = window.setInterval(
            () => setElapsed((value) => value + 1),
            1000,
          );
          const ctx = context.current!;
          const src = ctx.createMediaStreamSource(stream.current!);
          const proc = ctx.createScriptProcessor(4096, 1, 1);
          processor.current = proc;
          proc.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN)
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
        if (data.type === "billing") {
          setRemaining(data.remaining_seconds);
          onBalance(data.remaining_seconds);
        }
      };
      ws.onclose = (event) => {
        finishSession();
        if (event.reason === "balance_exhausted") setMessage(t.empty);
        else if (!userStopped.current && event.code !== 1000)
          setMessage(t.closed);
      };
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
  function finishSession() {
    setStatus("idle");
    processor.current?.disconnect();
    processor.current = null;
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }
  function stop() {
    userStopped.current = true;
    socket.current?.send(JSON.stringify({ type: "stop" }));
    setStatus("stopping");
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
    socket.current?.close();
    processor.current?.disconnect();
    if (timer.current !== null) clearInterval(timer.current);
    shutdownMedia();
  }
  async function testSound() {
    await prepare();
    const ctx = context.current!;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 440;
    gain.gain.value = 0.12 * (muted ? 0 : volume);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 1.2);
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
    <section className="interpreter-app">
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
        <button
          className="stop-button"
          onClick={stop}
          disabled={status === "stopping"}
        >
          <Square />
          {status === "stopping" ? t.stopping : t.stop}
        </button>
      )}
      <p className={`status-line ${status}`}>
        {status === "live" ? t.live : t.idle}
        <span>
          <Headphones size={15} />
          {t.headphones}
        </span>
      </p>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
