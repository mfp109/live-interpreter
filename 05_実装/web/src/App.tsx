import {
  ArrowRight,
  AudioLines,
  Check,
  Globe2,
  Headphones,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatTime, Product, User, Wallet } from "./api";
import { AuthDialog } from "./AuthDialog";
import { Interpreter } from "./Interpreter";
import { AdminPanel } from "./AdminPanel";
import { LegalPage } from "./LegalPage";
import { ResetPassword } from "./ResetPassword";
import { AccountTools } from "./AccountTools";

type Locale = "ja" | "en" | "zh-CN";
type View = "home" | "account";
const copy = {
  ja: {
    how: "使い方",
    price: "料金",
    faq: "よくある質問",
    login: "ログイン",
    account: "マイページ",
    cta: "15分無料で試す",
    eyebrow: "声が届けば、心も届く。",
    hero: "話した言葉を、\nそのまま世界へ。",
    lead: "マイクに話すだけ。低遅延のAI音声通訳が、あなたの声を別の言語へ届けます。字幕を読む必要はありません。",
    demo: "実際の通訳を見る",
    trial: "登録後15分無料",
    card: "ブラウザで今すぐ通訳",
    from: "入力言語",
    to: "出力言語",
    start: "無料で始める",
    why: "伝えたい瞬間を、待たせない。",
    pricing: "必要な時間だけ購入",
    notice: "音声と翻訳内容は原則保存しません。",
    verifySuccess: "メール確認が完了しました。無料時間を付与しました。",
    checkoutError: "決済を開始できませんでした。",
    greeting: "こんにちは",
    remaining: "残り通訳時間",
    free: "無料",
    paid: "有料",
    addTime: "通訳時間を追加",
    logout: "ログアウト",
    demoPlaceholder: "日本語→英語の音声付きデモ",
    demoTitle: "話し続けても、通訳は止まりません。",
    demoText:
      "日本語の話し声が英語音声として届く利用イメージを、音声付きの短いデモで確認できます。",
    speakTitle: "話す",
    speakText: "マイクと入力言語を選び、自然に話します。",
    interpretTitle: "通訳",
    interpretText: "AIが音声を途切れにくく低遅延で通訳します。",
    listenTitle: "聞く",
    listenText: "聞き手は選択した言語の自然な音声を聞きます。",
    pricingNote: "初回登録は15分無料。購入時間は秒単位で消費されます。",
    faqTitle: "よくある質問",
    faq1q: "会話は保存されますか？",
    faq1a:
      "音声、翻訳音声、翻訳本文は原則として保存しません。利用時間や言語ペアなどの運用情報だけを保存します。",
    faq2q: "残高がなくなるとどうなりますか？",
    faq2a:
      "通訳中継サーバーが残高を確認し、0秒になった時点で自動的に終了します。",
    faq3q: "どの端末で使えますか？",
    faq3a: "マイクが利用できる主要なPC・スマートフォンブラウザに対応します。",
    choose: "このプランを選ぶ",
    minutes: "分",
    terms: "利用規約",
    privacy: "プライバシー",
    commercial: "特定商取引法に基づく表記",
    refund: "返金ポリシー",
    cookie: "Cookieポリシー",
    contact: "お問い合わせ",
    back: "トップへ戻る",
  },
  en: {
    how: "How it works",
    price: "Pricing",
    faq: "FAQ",
    login: "Sign in",
    account: "My account",
    cta: "Try 15 minutes free",
    eyebrow: "When your voice reaches them, your heart can too.",
    hero: "Speak naturally.\nBe heard worldwide.",
    lead: "Just speak into your microphone. Low-latency AI interpretation carries your voice into another language—no subtitles to follow.",
    demo: "Watch a real demo",
    trial: "15 free minutes after signup",
    card: "Interpret now in your browser",
    from: "Input language",
    to: "Output language",
    start: "Start for free",
    why: "Keep the moment moving.",
    pricing: "Buy only the time you need",
    notice: "We do not normally store audio or translated content.",
    verifySuccess: "Email verified. Your free time has been added.",
    checkoutError: "Payment could not be started.",
    greeting: "Welcome",
    remaining: "Remaining interpretation time",
    free: "Free",
    paid: "Paid",
    addTime: "Add interpretation time",
    logout: "Sign out",
    demoPlaceholder: "Japanese-to-English audio demo",
    demoTitle: "Keep speaking. Interpretation keeps moving.",
    demoText:
      "Watch and hear a short demonstration of Japanese speech reaching listeners as English audio.",
    speakTitle: "Speak",
    speakText:
      "Choose your microphone and input language, then speak naturally.",
    interpretTitle: "Interpret",
    interpretText: "AI interprets continuously with low latency.",
    listenTitle: "Listen",
    listenText:
      "Your audience hears a natural voice in their selected language.",
    pricingNote:
      "New accounts receive 15 free minutes. Purchased time is used by the second.",
    faqTitle: "Frequently asked questions",
    faq1q: "Do you store conversations?",
    faq1a:
      "We do not normally store source audio, translated audio, or transcript content. We retain operational metadata such as duration and language pair.",
    faq2q: "What happens when time runs out?",
    faq2a: "The gateway checks your balance and automatically stops at zero.",
    faq3q: "Which devices are supported?",
    faq3a:
      "Current major PC and smartphone browsers with microphone access are supported.",
    choose: "Choose this plan",
    minutes: "minutes",
    terms: "Terms",
    privacy: "Privacy",
    commercial: "Commercial disclosure",
    refund: "Refund policy",
    cookie: "Cookie policy",
    contact: "Contact",
    back: "Back to home",
  },
  "zh-CN": {
    how: "使用方法",
    price: "价格",
    faq: "常见问题",
    login: "登录",
    account: "我的账户",
    cta: "免费试用15分钟",
    eyebrow: "声音传达，心意也能传达。",
    hero: "自然说话，\n让世界听见。",
    lead: "只需对着麦克风说话。低延迟AI语音口译会将您的声音转换成另一种语言，无需阅读字幕。",
    demo: "观看真实演示",
    trial: "注册后免费15分钟",
    card: "立即在浏览器中口译",
    from: "输入语言",
    to: "输出语言",
    start: "免费开始",
    why: "让沟通无需等待。",
    pricing: "只购买需要的时间",
    notice: "原则上不保存音频或翻译内容。",
    verifySuccess: "邮箱验证完成，免费时间已添加。",
    checkoutError: "无法开始付款。",
    greeting: "您好",
    remaining: "剩余口译时间",
    free: "免费",
    paid: "已购买",
    addTime: "添加口译时间",
    logout: "退出登录",
    demoPlaceholder: "日语转英语音频演示",
    demoTitle: "持续说话，口译不会停止。",
    demoText: "通过带声音的短片，了解日语语音转换为英语语音的使用方式。",
    speakTitle: "说话",
    speakText: "选择麦克风和输入语言，然后自然说话。",
    interpretTitle: "口译",
    interpretText: "AI以低延迟连续进行语音口译。",
    listenTitle: "收听",
    listenText: "听众会听到所选语言的自然语音。",
    pricingNote: "新注册用户可免费使用15分钟，购买时间按秒扣除。",
    faqTitle: "常见问题",
    faq1q: "会保存对话吗？",
    faq1a:
      "原则上不保存原始音频、翻译音频或文字内容，仅保存时长和语言组合等运行信息。",
    faq2q: "时间用完后会怎样？",
    faq2a: "中继服务器会检查余额，并在归零时自动停止。",
    faq3q: "支持哪些设备？",
    faq3a: "支持可使用麦克风的主流电脑和智能手机浏览器。",
    choose: "选择此套餐",
    minutes: "分钟",
    terms: "使用条款",
    privacy: "隐私政策",
    commercial: "商业交易说明",
    refund: "退款政策",
    cookie: "Cookie政策",
    contact: "联系我们",
    back: "返回首页",
  },
} as const;
const fallbackProducts = [
  {
    id: "00000000-0000-4000-8000-000000000060",
    code: "starter_60",
    name_key: "Starter",
    seconds_granted: 3600,
    price_minor: 1500,
    currency: "JPY",
  },
  {
    id: "00000000-0000-4000-8000-000000000300",
    code: "standard_300",
    name_key: "Standard",
    seconds_granted: 18000,
    price_minor: 5500,
    currency: "JPY",
  },
  {
    id: "00000000-0000-4000-8000-000000001000",
    code: "event_1000",
    name_key: "Event",
    seconds_granted: 60000,
    price_minor: 15000,
    currency: "JPY",
  },
];

function initialLocale(): Locale {
  const query = new URLSearchParams(location.search).get("lang");
  if (query === "ja" || query === "en" || query === "zh-CN") return query;
  const saved = localStorage.getItem("swli.locale");
  if (saved === "ja" || saved === "en" || saved === "zh-CN") return saved;
  const browser = navigator.language.toLowerCase();
  return browser.startsWith("zh")
    ? "zh-CN"
    : browser.startsWith("en")
      ? "en"
      : "ja";
}

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [view, setView] = useState<View>("home");
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet>({
    trial_seconds: 0,
    paid_seconds: 0,
    reserved_seconds: 0,
  });
  const [csrf, setCsrf] = useState("");
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [flash, setFlash] = useState("");
  const t = copy[locale];
  const heroLines = useMemo(() => t.hero.split("\n"), [t.hero]);
  useEffect(() => {
    localStorage.setItem("swli.locale", locale);
  }, [locale]);
  useEffect(() => {
    refreshAccount();
    api<{ products: Product[] }>("products.php")
      .then((r) => setProducts(r.products))
      .catch(() => {});
    const token = new URLSearchParams(location.search).get("token");
    if (location.pathname.includes("verify-email") && token) {
      api("auth/verify-email.php", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
        .then(() => {
          history.replaceState({}, "", "/");
          setFlash(t.verifySuccess);
          setAuth("login");
        })
        .catch((e) => setFlash(e.message));
    }
  }, []);
  async function refreshAccount() {
    try {
      const result = await api<{
        user: User;
        wallet: Wallet;
        csrf_token: string;
      }>("auth/me.php");
      setUser(result.user);
      setWallet(result.wallet);
      setCsrf(result.csrf_token);
    } catch {
      setUser(null);
    }
  }
  function openAccount() {
    if (!user) setAuth("login");
    else setView("account");
  }
  async function checkout(product: Product) {
    if (!user) {
      setAuth("register");
      return;
    }
    try {
      const result = await api<{ checkout_url: string }>(
        "checkout/create.php",
        { method: "POST", body: JSON.stringify({ product_id: product.id }) },
        csrf,
      );
      location.href = result.checkout_url;
    } catch (e) {
      setFlash(e instanceof Error ? e.message : t.checkoutError);
    }
  }
  async function logout() {
    await api("auth/logout.php", { method: "POST" }, csrf).catch(() => {});
    setUser(null);
    setView("home");
  }
  const total = Number(wallet.trial_seconds) + Number(wallet.paid_seconds);
  const path = location.pathname;
  const resetToken = new URLSearchParams(location.search).get("token") || "";
  if (path.includes("reset-password"))
    return (
      <div className="site">
        <ResetPassword token={resetToken} locale={locale} />
      </div>
    );
  const legalKind = path.includes("commercial-disclosure")
    ? "commercial-disclosure"
    : path.includes("refund")
      ? "refund"
      : path.includes("cookie")
        ? "cookie"
        : path.includes("contact")
          ? "contact"
          : path.includes("privacy")
            ? "privacy"
            : path.includes("terms")
              ? "terms"
              : null;
  if (legalKind)
    return (
      <div className="site">
        <header>
          <a className="brand" href="/">
            <span className="brand-mark">
              <AudioLines size={22} />
            </span>
            <span>
              ShalomWorks <b>Live Interpreter</b>
            </span>
          </a>
        </header>
        <LegalPage kind={legalKind} locale={locale} />
        <footer>
          <span>© 2026 ShalomWorks</span>
          <a href="/">{t.back || "Back"}</a>
        </footer>
      </div>
    );
  return (
    <div className="site">
      <header>
        <button className="brand brand-button" onClick={() => setView("home")}>
          <span className="brand-mark">
            <AudioLines size={22} />
          </span>
          <span>
            ShalomWorks <b>Live Interpreter</b>
          </span>
        </button>
        <nav>
          <a href="#how" onClick={() => setView("home")}>
            {t.how}
          </a>
          <a href="#pricing" onClick={() => setView("home")}>
            {t.price}
          </a>
          <a href="#faq" onClick={() => setView("home")}>
            {t.faq}
          </a>
        </nav>
        <div className="header-actions">
          <label className="locale">
            <Globe2 size={16} />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
              <option value="zh-CN">简体中文</option>
            </select>
          </label>
          <button className="link-button" onClick={openAccount}>
            {user ? t.account : t.login}
          </button>
          <button
            className="primary small"
            onClick={() => (user ? setView("account") : setAuth("register"))}
          >
            {user ? formatTime(total) : t.cta}
          </button>
        </div>
      </header>
      {flash && (
        <div className="flash" onClick={() => setFlash("")}>
          {flash}
          <button>×</button>
        </div>
      )}
      {view === "account" && user ? (
        <main className="account-page">
          <section className="account-summary">
            <div>
              <p className="section-kicker">
                {user.role === "admin" ? "ADMINISTRATOR" : "MY ACCOUNT"}
              </p>
              <h1>
                {t.greeting}
                {user.display_name ? `、${user.display_name}` : ""}
              </h1>
              <p>{user.email}</p>
            </div>
            {user.role !== "admin" && (
              <div className="balance-card">
                <span>{t.remaining}</span>
                <strong>{formatTime(total)}</strong>
                <small>
                  {t.free} {formatTime(Number(wallet.trial_seconds))} ／{" "}
                  {t.paid} {formatTime(Number(wallet.paid_seconds))}
                </small>
              </div>
            )}
          </section>
          {user.role === "admin" ? (
            <AdminPanel csrf={csrf} />
          ) : (
            <>
              <Interpreter
                wallet={wallet}
                csrf={csrf}
                locale={locale}
                onBalance={(seconds) =>
                  setWallet((w) => ({
                    ...w,
                    trial_seconds: Math.min(Number(w.trial_seconds), seconds),
                    paid_seconds: Math.max(
                      0,
                      seconds - Math.min(Number(w.trial_seconds), seconds),
                    ),
                  }))
                }
              />
              <section className="account-products">
                <h2>{t.addTime}</h2>
                <ProductCards
                  products={products}
                  onChoose={checkout}
                  choose={t.choose}
                  minutes={t.minutes}
                />
              </section>
              <AccountTools
                locale={locale}
                csrf={csrf}
                onDeleted={() => {
                  setUser(null);
                  setView("home");
                }}
              />
            </>
          )}
          <div className="account-actions">
            <button className="link-button" onClick={logout}>
              {t.logout}
            </button>
          </div>
        </main>
      ) : (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">
                <Sparkles size={16} />
                {t.eyebrow}
              </p>
              <h1>
                {heroLines.map((line, i) => (
                  <span key={line}>
                    {line}
                    {i === 0 && <br />}
                  </span>
                ))}
              </h1>
              <p className="lead">{t.lead}</p>
              <div className="hero-actions">
                <button className="primary" onClick={() => setAuth("register")}>
                  {t.cta}
                  <ArrowRight size={19} />
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    document
                      .getElementById("demo")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <Play size={17} />
                  {t.demo}
                </button>
              </div>
              <p className="trial">
                <Check size={16} />
                {t.trial}
                <span>•</span>
                <ShieldCheck size={16} />
                {t.notice}
              </p>
            </div>
            <div className="interpreter-card">
              <div className="card-top">
                <div>
                  <span className="live-dot" /> LIVE INTERPRETER
                </div>
                <span className="balance">15:00 FREE</span>
              </div>
              <h2>{t.card}</h2>
              <div className="language-row">
                <label>
                  {t.from}
                  <select>
                    <option>日本語</option>
                    <option>English</option>
                    <option>中文</option>
                  </select>
                </label>
                <span className="swap">→</span>
                <label>
                  {t.to}
                  <select>
                    <option>English</option>
                    <option>日本語</option>
                    <option>中文</option>
                  </select>
                </label>
              </div>
              <div className="wave" aria-label="microphone level">
                {Array.from({ length: 28 }, (_, i) => (
                  <i key={i} style={{ height: `${16 + ((i * 17) % 48)}px` }} />
                ))}
              </div>
              <button className="start" onClick={() => setAuth("register")}>
                <span className="mic">●</span>
                {t.start}
              </button>
              <p>
                <Headphones size={15} /> Headphones recommended
              </p>
            </div>
          </section>
          <section className="trust">
            <span>FOR CHURCHES</span>
            <span>EVENTS</span>
            <span>EDUCATION</span>
            <span>TRAVEL</span>
            <span>CUSTOMER SUPPORT</span>
          </section>
          <section id="demo" className="demo-section">
            <div className="demo-video-wrap">
              <video
                className="demo-video"
                controls
                playsInline
                preload="metadata"
              >
                <source src="/media/live-demo.mp4" type="video/mp4" />
              </video>
              <span>{t.demoPlaceholder}</span>
            </div>
            <div>
              <p className="section-kicker">SEE IT IN ACTION</p>
              <h2>{t.demoTitle}</h2>
              <p>{t.demoText}</p>
            </div>
          </section>
          <section id="how" className="section">
            <p className="section-kicker">WHY LIVE INTERPRETER</p>
            <h2>{t.why}</h2>
            <div className="features">
              <article>
                <b>01</b>
                <h3>{t.speakTitle}</h3>
                <p>{t.speakText}</p>
              </article>
              <article>
                <b>02</b>
                <h3>{t.interpretTitle}</h3>
                <p>{t.interpretText}</p>
              </article>
              <article>
                <b>03</b>
                <h3>{t.listenTitle}</h3>
                <p>{t.listenText}</p>
              </article>
            </div>
          </section>
          <section id="pricing" className="section pricing">
            <p className="section-kicker">SIMPLE PRICING</p>
            <h2>{t.pricing}</h2>
            <ProductCards
              products={products}
              onChoose={checkout}
              choose={t.choose}
              minutes={t.minutes}
            />
            <p className="pricing-note">{t.pricingNote}</p>
          </section>
          <section id="faq" className="section faq">
            <p className="section-kicker">FAQ</p>
            <h2>{t.faqTitle}</h2>
            <details>
              <summary>{t.faq1q}</summary>
              <p>{t.faq1a}</p>
            </details>
            <details>
              <summary>{t.faq2q}</summary>
              <p>{t.faq2a}</p>
            </details>
            <details>
              <summary>{t.faq3q}</summary>
              <p>{t.faq3a}</p>
            </details>
          </section>
        </main>
      )}
      <footer>
        <span>© 2026 ShalomWorks</span>
        <span>
          <a href="/terms">{t.terms}</a> · <a href="/privacy">{t.privacy}</a> ·{" "}
          <a href="/commercial-disclosure">{t.commercial}</a>
          {" · "}
          <a href="/refund">{t.refund}</a>
          {" · "}
          <a href="/cookie">{t.cookie}</a>
          {" · "}
          <a href="/contact">{t.contact}</a>
        </span>
      </footer>
      {auth && (
        <AuthDialog
          mode={auth}
          onClose={() => setAuth(null)}
          onSignedIn={refreshAccount}
          locale={locale}
        />
      )}
    </div>
  );
}

function ProductCards({
  products,
  onChoose,
  choose,
  minutes,
}: {
  products: Product[];
  onChoose: (product: Product) => void;
  choose: string;
  minutes: string;
}) {
  return (
    <div className="plans">
      {products.map((product, index) => (
        <article className={index === 1 ? "popular" : ""} key={product.id}>
          {index === 1 && <span className="badge">MOST POPULAR</span>}
          <h3>
            {product.code.startsWith("starter")
              ? "Starter"
              : product.code.startsWith("standard")
                ? "Standard"
                : "Event"}
          </h3>
          <strong>¥{Number(product.price_minor).toLocaleString()}</strong>
          <p>
            {Math.round(Number(product.seconds_granted) / 60).toLocaleString()}{" "}
            {minutes}
          </p>
          <button
            className={index === 1 ? "primary" : "secondary"}
            onClick={() => onChoose(product)}
          >
            {choose}
          </button>
        </article>
      ))}
    </div>
  );
}
