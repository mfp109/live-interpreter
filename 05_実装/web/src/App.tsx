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
import {
  api,
  formatCredits,
  Product,
  Subscription,
  User,
  Wallet,
} from "./api";
import { AuthDialog } from "./AuthDialog";
import { Interpreter } from "./Interpreter";
import { AdminPanel } from "./AdminPanel";
import { LegalPage } from "./LegalPage";
import { ResetPassword } from "./ResetPassword";
import { AccountTools } from "./AccountTools";
import { isLocale, Locale, localeOptions } from "./locales";
import { siteCopyExtra } from "./site-copy-extra";

type View = "home" | "account";
const copy = {
  ja: {
    how: "使い方",
    price: "料金",
    faq: "よくある質問",
    login: "ログイン",
    account: "マイページ",
    cta: "1分無料で試す",
    eyebrow: "声が届けば、心も届く。",
    hero: "話した言葉を、\nそのまま世界へ。",
    lead: "マイクに話すだけ。低遅延のAI音声通訳が、あなたの声を別の言語へ届けます。字幕を読む必要はありません。",
    demo: "実際の通訳を見る",
    trial: "登録後1分無料",
    card: "ブラウザで今すぐ通訳",
    from: "入力言語",
    to: "出力言語",
    start: "無料で始める",
    why: "伝えたい瞬間を、待たせない。",
    pricing: "月額プランと追加クレジット",
    notice: "音声と翻訳内容は原則保存しません。",
    verifySuccess: "メール確認が完了しました。無料時間を付与しました。",
    checkoutError: "決済を開始できませんでした。",
    greeting: "こんにちは",
    remaining: "LIクレジット残高",
    free: "無料",
    paid: "有料",
    addTime: "クレジットを追加",
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
    pricingNote:
      "1クレジットは日本語音声を日本語字幕にする1秒分が基準です。音声通訳は1秒につき12クレジットを消費します。月額分は毎月更新され、追加購入分は180日間有効です。",
    introName: "初回お試し",
    introBadge: "初回購入限定",
    subscriptionHeading: "月額プラン",
    topupHeading: "追加クレジット",
    monthly: "月",
    credits: "LIクレジット",
    manageSubscription: "サブスクリプションを管理",
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
    cta: "Try 1 minute free",
    eyebrow: "When your voice reaches them, your heart can too.",
    hero: "Speak naturally.\nBe heard worldwide.",
    lead: "Just speak into your microphone. Low-latency AI interpretation carries your voice into another language—no subtitles to follow.",
    demo: "Watch a real demo",
    trial: "1 free minute after signup",
    card: "Interpret now in your browser",
    from: "Input language",
    to: "Output language",
    start: "Start for free",
    why: "Keep the moment moving.",
    pricing: "Monthly plans and extra credits",
    notice: "We do not normally store audio or translated content.",
    verifySuccess: "Email verified. Your free time has been added.",
    checkoutError: "Payment could not be started.",
    greeting: "Welcome",
    remaining: "LI Credit balance",
    free: "Free",
    paid: "Paid",
    addTime: "Add credits",
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
      "One credit is based on one second of Japanese speech-to-Japanese captions. Voice interpretation uses 12 credits per second. Monthly credits refresh each billing cycle; extra credits remain valid for 180 days.",
    introName: "First Try",
    introBadge: "FIRST PURCHASE ONLY",
    subscriptionHeading: "Monthly plans",
    topupHeading: "Extra credits",
    monthly: "month",
    credits: "LI Credits",
    manageSubscription: "Manage subscription",
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
    cta: "免费试用1分钟",
    eyebrow: "声音传达，心意也能传达。",
    hero: "自然说话，\n让世界听见。",
    lead: "只需对着麦克风说话。低延迟AI语音口译会将您的声音转换成另一种语言，无需阅读字幕。",
    demo: "观看真实演示",
    trial: "注册后免费1分钟",
    card: "立即在浏览器中口译",
    from: "输入语言",
    to: "输出语言",
    start: "免费开始",
    why: "让沟通无需等待。",
    pricing: "月度套餐和追加积分",
    notice: "原则上不保存音频或翻译内容。",
    verifySuccess: "邮箱验证完成，免费时间已添加。",
    checkoutError: "无法开始付款。",
    greeting: "您好",
    remaining: "LI积分余额",
    free: "免费",
    paid: "已购买",
    addTime: "追加积分",
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
    pricingNote:
      "1积分以1秒日语语音转日语字幕的API用量为基准。语音口译每秒消耗12积分。月度积分按账单周期更新，追加积分有效期为180天。",
    introName: "首次体验",
    introBadge: "仅限首次购买",
    subscriptionHeading: "月度套餐",
    topupHeading: "追加积分",
    monthly: "月",
    credits: "LI积分",
    manageSubscription: "管理订阅",
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
    id: "00000000-0000-4000-8000-000000000030",
    code: "intro_30",
    name_key: "product.intro",
    product_type: "intro" as const,
    billing_interval: "one_time" as const,
    seconds_granted: 21600,
    price_minor: 500,
    currency: "JPY",
  },
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "subscription_lite",
    name_key: "product.subscription.lite",
    product_type: "subscription" as const,
    billing_interval: "month" as const,
    seconds_granted: 43200,
    price_minor: 980,
    currency: "JPY",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    code: "subscription_standard",
    name_key: "product.subscription.standard",
    product_type: "subscription" as const,
    billing_interval: "month" as const,
    seconds_granted: 108000,
    price_minor: 1980,
    currency: "JPY",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    code: "subscription_pro",
    name_key: "product.subscription.pro",
    product_type: "subscription" as const,
    billing_interval: "month" as const,
    seconds_granted: 259200,
    price_minor: 3980,
    currency: "JPY",
  },
  {
    id: "20000000-0000-4000-8000-000000000001",
    code: "topup_small",
    name_key: "product.topup.small",
    product_type: "topup" as const,
    billing_interval: "one_time" as const,
    seconds_granted: 18000,
    price_minor: 500,
    currency: "JPY",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    code: "topup_medium",
    name_key: "product.topup.medium",
    product_type: "topup" as const,
    billing_interval: "one_time" as const,
    seconds_granted: 72000,
    price_minor: 1500,
    currency: "JPY",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    code: "topup_large",
    name_key: "product.topup.large",
    product_type: "topup" as const,
    billing_interval: "one_time" as const,
    seconds_granted: 180000,
    price_minor: 3000,
    currency: "JPY",
  },
];

const pageMetadata = {
  ja: {
    lang: "ja",
    title: "Live Interpreter | AI音声通訳をブラウザーで",
    description:
      "マイクに話すだけで、声を別の言語の音声へ。会議・イベント・授業・地域活動で使えるブラウザー型AI音声通訳。登録後1分無料。",
    socialTitle: "Live Interpreter | 話した言葉を、別の言語の音声へ",
    socialDescription:
      "インストール不要のAI音声通訳。PCやスマートフォンのブラウザーで、1分無料で試せます。",
    ogLocale: "ja_JP",
  },
  en: {
    lang: "en",
    title: "Live Interpreter | Real-time AI voice interpretation",
    description:
      "Speak into your microphone and be heard in another language. Browser-based AI voice interpretation for meetings, events, education, and communities. Try 1 minute free.",
    socialTitle: "Live Interpreter | Speak naturally. Be heard worldwide.",
    socialDescription:
      "Low-latency AI voice interpretation in your browser. No app installation required. Try 1 minute free after signup.",
    ogLocale: "en_US",
  },
  "zh-CN": {
    lang: "zh-CN",
    title: "Live Interpreter | 浏览器AI实时语音口译",
    description:
      "只需对着麦克风说话，即可将语音转换为另一种语言。适用于会议、活动、教育和社区交流。注册后可免费试用1分钟。",
    socialTitle: "Live Interpreter | 自然说话，让世界听见",
    socialDescription:
      "无需安装应用的AI语音口译服务。可直接在电脑或手机浏览器中使用，注册后免费试用1分钟。",
    ogLocale: "zh_CN",
  },
} as const;

function setMetaContent(selector: string, content: string) {
  document
    .querySelector<HTMLMetaElement>(selector)
    ?.setAttribute("content", content);
}

function initialLocale(): Locale {
  const query = new URLSearchParams(location.search).get("lang");
  if (isLocale(query)) return query;
  const saved = localStorage.getItem("swli.locale");
  if (isLocale(saved)) return saved;
  const browser = navigator.language.toLowerCase();
  const matched = localeOptions.find(([code]) => browser.startsWith(code.toLowerCase().split("-")[0]));
  return matched?.[0] || "ja";
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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [flash, setFlash] = useState("");
  const t = {
    ...copy.en,
    ...(copy[locale as keyof typeof copy] || {}),
    ...(siteCopyExtra[locale] || {}),
  };
  const heroLines = useMemo(() => t.hero.split("\n"), [t.hero]);
  useEffect(() => {
    localStorage.setItem("swli.locale", locale);
    const metadata = pageMetadata[locale as keyof typeof pageMetadata] ?? pageMetadata.en;
    document.documentElement.lang = metadata.lang;
    document.title = metadata.title;
    setMetaContent('meta[name="description"]', metadata.description);
    setMetaContent('meta[property="og:title"]', metadata.socialTitle);
    setMetaContent(
      'meta[property="og:description"]',
      metadata.socialDescription,
    );
    setMetaContent('meta[property="og:locale"]', metadata.ogLocale);
    setMetaContent('meta[name="twitter:title"]', metadata.socialTitle);
    setMetaContent(
      'meta[name="twitter:description"]',
      metadata.socialDescription,
    );
    const url = new URL(location.href);
    if (url.searchParams.get("lang") !== locale) {
      url.searchParams.set("lang", locale);
      history.replaceState(
        history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [locale]);
  useEffect(() => {
    refreshAccount();
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
  async function refreshProducts() {
    try {
      const result = await api<{
        products: Product[];
        subscription: Subscription | null;
      }>("products.php");
      setProducts(result.products);
      setSubscription(result.subscription || null);
    } catch {
      setProducts(fallbackProducts);
    }
  }
  async function refreshAccount() {
    try {
      const result = await api<{
        user: User;
        wallet: Wallet;
        subscription: Subscription | null;
        csrf_token: string;
      }>("auth/me.php");
      setUser(result.user);
      setWallet(result.wallet);
      setSubscription(result.subscription || null);
      setCsrf(result.csrf_token);
    } catch {
      setUser(null);
    } finally {
      await refreshProducts();
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
    setSubscription(null);
    setView("home");
    await refreshProducts();
  }
  async function manageSubscription() {
    try {
      const result = await api<{ portal_url: string }>(
        "subscription/portal.php",
        { method: "POST" },
        csrf,
      );
      location.href = result.portal_url;
    } catch (e) {
      setFlash(e instanceof Error ? e.message : t.checkoutError);
    }
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
              {localeOptions.map(([code, label]) => (
                <option value={code} key={code}>{label}</option>
              ))}
            </select>
          </label>
          <button className="link-button" onClick={openAccount}>
            {user ? t.account : t.login}
          </button>
          <button
            className="primary small"
            onClick={() => (user ? setView("account") : setAuth("register"))}
          >
            {user ? formatCredits(total) : t.cta}
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
                <strong>{formatCredits(total)}</strong>
                <small>
                  {t.free} {formatCredits(Number(wallet.trial_seconds))} ／{" "}
                  {t.paid} {formatCredits(Number(wallet.paid_seconds))}
                </small>
                {subscription && (
                  <button className="link-button" onClick={manageSubscription}>
                    {t.manageSubscription}
                  </button>
                )}
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
                  products={products.filter((product) =>
                    subscription
                      ? product.product_type === "topup"
                      : product.product_type === "subscription" ||
                        product.product_type === "intro",
                  )}
                  onChoose={checkout}
                  choose={t.choose}
                  introName={t.introName}
                  introBadge={t.introBadge}
                  monthly={t.monthly}
                  credits={t.credits}
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
                <span className="balance">1:00 FREE</span>
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
            <span>EVENTS</span>
            <span>EDUCATION</span>
            <span>INTERNATIONAL COMMUNITIES</span>
            <span>FAITH COMMUNITIES</span>
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
              products={products.filter(
                (product) =>
                  product.product_type === "subscription" ||
                  product.product_type === "intro",
              )}
              onChoose={checkout}
              choose={t.choose}
              introName={t.introName}
              introBadge={t.introBadge}
              monthly={t.monthly}
              credits={t.credits}
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
  introName,
  introBadge,
  monthly,
  credits,
}: {
  products: Product[];
  onChoose: (product: Product) => void;
  choose: string;
  introName: string;
  introBadge: string;
  monthly: string;
  credits: string;
}) {
  return (
    <div className="plans">
      {products.map((product) => {
        const isIntro = product.code.startsWith("intro");
        const isPopular = product.code === "subscription_standard";
        return (
          <article className={isPopular ? "popular" : ""} key={product.id}>
            {(isIntro || isPopular) && (
              <span className="badge">
                {isIntro ? introBadge : "MOST POPULAR"}
              </span>
            )}
            <h3>
              {isIntro
                ? introName
                : product.code === "subscription_lite"
                  ? "Lite"
                  : product.code === "subscription_standard"
                    ? "Standard"
                    : product.code === "subscription_pro"
                      ? "Pro"
                      : product.code === "topup_small"
                        ? "Small"
                        : product.code === "topup_medium"
                          ? "Medium"
                          : "Large"}
            </h3>
            <strong>
              ¥{Number(product.price_minor).toLocaleString()}
              {product.billing_interval === "month" ? ` / ${monthly}` : ""}
            </strong>
            <p>
              {formatCredits(Number(product.seconds_granted))} {credits}
            </p>
            <button
              className={isPopular ? "primary" : "secondary"}
              onClick={() => onChoose(product)}
            >
              {choose}
            </button>
          </article>
        );
      })}
    </div>
  );
}
