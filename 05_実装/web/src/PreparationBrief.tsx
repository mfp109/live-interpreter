import { AlertTriangle, CheckCircle2, Languages, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { api, ApiError } from "./api";

type Locale = "ja" | "en" | "zh-CN";
type Brief = {
  summary: string;
  terms: { source: string; translation: string; note: string }[];
  risks: string[];
  speaking_tips: string[];
  checklist: string[];
};

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

const text = {
  ja: {
    kicker: "GPT-5.6 MEETING PREP",
    title: "AI会議準備ブリーフ",
    lead: "通訳前に状況と重要語を整理し、伝わりにくい箇所を先に確認できます。リアルタイム通訳の内容や設定は変更しません。",
    source: "話す言語",
    target: "通訳先の言語",
    situation: "どんな場面ですか？（必須）",
    situationHint:
      "例：海外ゲストを迎える日曜礼拝。司会挨拶とメッセージを通訳する。",
    purpose: "目的（任意）",
    purposeHint: "例：初めての参加者にも自然に伝える",
    terms: "重要な名前・数字・専門用語（任意）",
    termsHint: "例：ShalomWorks、Grace、John 3:16、受付は10:30",
    generate: "準備ブリーフを作る",
    generating: "GPT-5.6で作成中…",
    count: "本日の残り作成回数",
    summary: "場面の整理",
    termsTitle: "重要語の確認",
    risks: "注意しやすい箇所",
    tips: "話し方のコツ",
    checklist: "開始前チェック",
    same: "2つの言語を別々に選んでください。",
    required: "場面を入力してください。",
    tooLong: "入力は合計2,000文字以内にしてください。",
    limit: "本日の作成上限（5回）に達しました。",
    unavailable:
      "現在AI準備機能を利用できません。少し待ってからもう一度お試しください。",
    chars: "文字",
  },
  en: {
    kicker: "GPT-5.6 MEETING PREP",
    title: "AI meeting preparation brief",
    lead: "Review context and important terms before interpreting. This does not change the realtime interpretation model or its settings.",
    source: "Spoken language",
    target: "Interpretation language",
    situation: "What is the situation? (required)",
    situationHint: "Example: A Sunday service welcoming overseas guests.",
    purpose: "Purpose (optional)",
    purposeHint: "Example: Make the message clear for first-time visitors",
    terms: "Important names, numbers, and terms (optional)",
    termsHint: "Example: ShalomWorks, Grace, John 3:16, reception at 10:30",
    generate: "Create preparation brief",
    generating: "Creating with GPT-5.6…",
    count: "Generations remaining today",
    summary: "Session overview",
    termsTitle: "Key terms",
    risks: "Potential risks",
    tips: "Speaking tips",
    checklist: "Pre-session checklist",
    same: "Choose two different languages.",
    required: "Describe the situation.",
    tooLong: "Keep the total input within 2,000 characters.",
    limit: "You have reached today's limit of five briefs.",
    unavailable:
      "AI preparation is temporarily unavailable. Please try again shortly.",
    chars: "characters",
  },
  "zh-CN": {
    kicker: "GPT-5.6 MEETING PREP",
    title: "AI会议准备简报",
    lead: "在口译前整理场景和重要词语。本功能不会更改实时口译模型或其设置。",
    source: "讲话语言",
    target: "口译目标语言",
    situation: "什么场景？（必填）",
    situationHint: "例：欢迎海外来宾的主日礼拜。",
    purpose: "目的（可选）",
    purposeHint: "例：让首次参加者也能自然理解",
    terms: "重要姓名、数字和术语（可选）",
    termsHint: "例：ShalomWorks、Grace、John 3:16、10:30接待",
    generate: "生成准备简报",
    generating: "正在使用GPT-5.6生成…",
    count: "今日剩余生成次数",
    summary: "场景概要",
    termsTitle: "重要词语",
    risks: "注意事项",
    tips: "讲话技巧",
    checklist: "开始前检查",
    same: "请选择两种不同的语言。",
    required: "请输入场景。",
    tooLong: "输入总计不得超过2,000个字符。",
    limit: "已达到今日5次的生成上限。",
    unavailable: "AI准备功能暂时不可用，请稍后重试。",
    chars: "字",
  },
} as const;

export function PreparationBrief({
  csrf,
  locale,
}: {
  csrf: string;
  locale: Locale;
}) {
  const t = text[locale];
  const [source, setSource] = useState("ja");
  const [target, setTarget] = useState("en");
  const [situation, setSituation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keyTerms, setKeyTerms] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const length = useMemo(
    () => situation.length + purpose.length + keyTerms.length,
    [situation, purpose, keyTerms],
  );

  async function generate() {
    setMessage("");
    if (source === target) return setMessage(t.same);
    if (!situation.trim()) return setMessage(t.required);
    if (length > 2000) return setMessage(t.tooLong);
    setLoading(true);
    try {
      const result = await api<{ brief: Brief; remaining_generations: number }>(
        "preparation/generate.php",
        {
          method: "POST",
          body: JSON.stringify({
            source_language: source,
            target_language: target,
            situation,
            purpose,
            key_terms: keyTerms,
            locale,
          }),
        },
        csrf,
      );
      setBrief(result.brief);
      setRemaining(result.remaining_generations);
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.code === "DAILY_LIMIT_REACHED"
          ? t.limit
          : t.unavailable,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="preparation-brief">
      <div className="preparation-heading">
        <div>
          <p className="section-kicker">
            <Sparkles size={15} /> {t.kicker}
          </p>
          <h2>{t.title}</h2>
          <p>{t.lead}</p>
        </div>
        {remaining !== null && (
          <span className="preparation-count">
            {t.count}
            <strong>{remaining} / 5</strong>
          </span>
        )}
      </div>
      <div className="preparation-languages">
        <label>
          {t.source}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {languages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span>→</span>
        <label>
          {t.target}
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {languages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="preparation-fields">
        <label>
          {t.situation}
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder={t.situationHint}
            rows={3}
          />
        </label>
        <label>
          {t.purpose}
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={t.purposeHint}
          />
        </label>
        <label>
          {t.terms}
          <textarea
            value={keyTerms}
            onChange={(e) => setKeyTerms(e.target.value)}
            placeholder={t.termsHint}
            rows={2}
          />
        </label>
      </div>
      <div className={`preparation-length ${length > 2000 ? "over" : ""}`}>
        {length.toLocaleString()} / 2,000 {t.chars}
      </div>
      <button
        className="primary preparation-generate"
        onClick={generate}
        disabled={loading || length > 2000}
      >
        <Sparkles size={18} /> {loading ? t.generating : t.generate}
      </button>
      {message && <p className="form-message">{message}</p>}
      {brief && (
        <div className="brief-results" aria-live="polite">
          <article className="brief-summary">
            <Languages />
            <div>
              <h3>{t.summary}</h3>
              <p>{brief.summary}</p>
            </div>
          </article>
          {brief.terms.length > 0 && (
            <article>
              <h3>{t.termsTitle}</h3>
              <div className="term-table">
                {brief.terms.map((term, index) => (
                  <div key={`${term.source}-${index}`}>
                    <strong>{term.source}</strong>
                    <span>→</span>
                    <b>{term.translation}</b>
                    <small>{term.note}</small>
                  </div>
                ))}
              </div>
            </article>
          )}
          <div className="brief-columns">
            <article>
              <h3>
                <AlertTriangle size={18} />
                {t.risks}
              </h3>
              <ul>
                {brief.risks.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>
                <Sparkles size={18} />
                {t.tips}
              </h3>
              <ul>
                {brief.speaking_tips.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>
                <CheckCircle2 size={18} />
                {t.checklist}
              </h3>
              <ul>
                {brief.checklist.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
