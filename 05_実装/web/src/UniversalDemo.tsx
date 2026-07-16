import { Volume2 } from "lucide-react";
import type { CSSProperties } from "react";

type UniversalDemoProps = {
  label: string;
  soundLabel: string;
};

function playSonicLogo() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.35);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 6.8);
  master.connect(context.destination);

  const notes = [196, 246.94, 293.66, 369.99, 493.88];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index < 3 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index % 2 ? 3 : -3;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      index < 3 ? 0.17 : 0.06,
      context.currentTime + 0.45 + index * 0.22,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 5.4 + index * 0.25,
    );
    oscillator.connect(gain).connect(master);
    oscillator.start(context.currentTime + index * 0.16);
    oscillator.stop(context.currentTime + 7.1);
  });

  window.setTimeout(() => void context.close(), 7400);
}

export function UniversalDemo({ label, soundLabel }: UniversalDemoProps) {
  return (
    <div className="universal-demo" role="img" aria-label={label}>
      <div className="universal-grid" aria-hidden="true" />
      <div className="demo-orbit demo-orbit-one" aria-hidden="true" />
      <div className="demo-orbit demo-orbit-two" aria-hidden="true" />

      <div className="script-cloud" aria-hidden="true">
        {["あ", "A", "文", "한", "अ", "Ñ", "ع"].map((glyph, index) => (
          <i key={glyph} style={{ "--glyph-index": index } as CSSProperties}>
            {glyph}
          </i>
        ))}
      </div>

      <div className="voice-source" aria-hidden="true">
        <span />
        <div className="source-wave">
          {Array.from({ length: 11 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--bar-index": index,
                  "--bar-height": `${18 + ((index * 17) % 54)}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <div className="translation-stream" aria-hidden="true">
        <span className="stream-line" />
        {Array.from({ length: 6 }, (_, index) => (
          <i key={index} style={{ "--pulse-index": index } as CSSProperties} />
        ))}
      </div>

      <div className="demo-sonic-core" aria-hidden="true">
        <span className="sonic-logo">
          <i />
          <i />
        </span>
        <b />
      </div>

      <div className="listener-world" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            className={`listener listener-${index + 1}`}
            key={index}
            style={{ "--listener-index": index } as CSSProperties}
          >
            <i />
          </span>
        ))}
      </div>

      <button className="demo-sound" type="button" onClick={playSonicLogo}>
        <Volume2 size={16} />
        {soundLabel}
      </button>
    </div>
  );
}
