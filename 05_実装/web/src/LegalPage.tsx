import { useEffect, useState } from "react";
import { api } from "./api";
type Kind =
  | "terms"
  | "privacy"
  | "commercial-disclosure"
  | "refund"
  | "cookie"
  | "contact";
type Locale = "ja" | "en" | "zh-CN";
const content = {
  ja: {
    terms: [
      "利用規約",
      "本規約は、ShalomWorksが提供するリアルタイム音声通訳サービスの利用条件を定めます。",
      "サービス",
      "本サービスはAIによる音声通訳を提供します。翻訳の完全性・正確性を保証するものではなく、医療、法律、生命、安全に関わる重要判断の唯一の根拠として利用しないでください。",
      "通訳時間",
      "無料時間および購入時間は譲渡・換金できません。利用時間は秒単位で差し引かれます。有料時間の有効期限は購入日から180日です。",
      "禁止事項",
      "不正登録、認証回避、残高改ざん、第三者への迷惑行為、法令違反、サービスへの過度な負荷を禁止します。",
    ],
    privacy: [
      "プライバシーポリシー",
      "会員情報、決済識別子、利用時間、言語ペア、技術ログをサービス提供・不正防止・会計・サポートのために取り扱います。",
      "保存しない情報",
      "音声、翻訳音声、入力・出力の文字起こし本文は原則として保存しません。",
      "外部サービス",
      "音声通訳にOpenAI、決済にStripe、ホスティングにConoHaを利用します。カード番号は当サービスでは保存しません。",
    ],
    commercial: [
      "特定商取引法に基づく表記",
      "販売事業者",
      "運営名",
      "所在地",
      "電話番号",
      "メール",
      "販売価格",
      "各商品ページに税込価格を表示します。",
      "支払方法・時期",
      "クレジットカード。購入時に決済されます。",
      "提供時期",
      "決済完了確認後、通訳時間を直ちに付与します。",
      "返品・キャンセル",
      "利用済み時間は返金できません。未使用分および法令上必要な対応は返金ポリシーに従います。",
    ],
    back: "トップへ戻る",
  },
  en: {
    terms: [
      "Terms of Service",
      "These terms govern the ShalomWorks realtime voice interpretation service.",
      "Service",
      "The service uses AI interpretation and does not guarantee complete accuracy. Do not use it as the sole basis for medical, legal, life, or safety-critical decisions.",
      "Interpretation time",
      "Free and purchased time cannot be transferred or redeemed for cash. Time is deducted by the second. Purchased time expires 180 days after purchase.",
      "Prohibited use",
      "Fraudulent registration, authentication bypass, balance tampering, unlawful conduct, abuse, and excessive load are prohibited.",
    ],
    privacy: [
      "Privacy Policy",
      "We process account data, payment identifiers, usage duration, language pairs, and technical logs to provide the service, prevent fraud, maintain accounts, and provide support.",
      "Content we do not store",
      "We do not normally store source audio, translated audio, or source/target transcript content.",
      "Service providers",
      "We use OpenAI for interpretation, Stripe for payments, and ConoHa for hosting. We do not store card numbers.",
    ],
    commercial: [
      "Commercial Disclosure",
      "Seller",
      "Operator",
      "Address",
      "Phone",
      "Email",
      "Price",
      "Displayed for each product, including applicable tax.",
      "Payment",
      "Credit card, charged at purchase.",
      "Delivery",
      "Interpretation time is added after payment confirmation.",
      "Refunds",
      "Used digital service time is non-refundable. Unused time and legally required remedies follow the refund policy.",
    ],
    back: "Back to home",
  },
  "zh-CN": {
    terms: [
      "使用条款",
      "本条款规定ShalomWorks实时语音口译服务的使用条件。",
      "服务",
      "本服务使用AI口译，不保证完全准确。请勿将其作为医疗、法律、生命或安全相关重要决定的唯一依据。",
      "口译时间",
      "免费及购买时间不可转让或兑换现金，按秒扣除。购买时间自购买日起180天后到期。",
      "禁止行为",
      "禁止欺诈注册、绕过认证、篡改余额、违法行为、骚扰及造成过度负载。",
    ],
    privacy: [
      "隐私政策",
      "我们处理账户信息、付款标识、使用时长、语言组合和技术日志，以提供服务、防止欺诈、进行会计管理和客户支持。",
      "不保存的内容",
      "原则上不保存原始音频、翻译音频或输入输出文字内容。",
      "外部服务",
      "口译使用OpenAI，付款使用Stripe，托管使用ConoHa。本站不保存银行卡号。",
    ],
    commercial: [
      "商业交易说明",
      "销售者",
      "运营名称",
      "地址",
      "电话",
      "电子邮箱",
      "价格",
      "各商品页面显示含适用税费的价格。",
      "付款方式和时间",
      "信用卡，购买时扣款。",
      "提供时间",
      "确认付款后立即添加口译时间。",
      "退款",
      "已使用的数字服务时间不可退款，未使用时间及法律要求的处理遵循退款政策。",
    ],
    back: "返回首页",
  },
} as const;
const supplemental = {
  ja: {
    refund: [
      "返金・キャンセルポリシー",
      "購入前に商品内容と時間をご確認ください。",
      "返金",
      "利用済みの通訳時間は、サービスの性質上返金できません。重複決済、当サービスの障害により利用できなかった未使用分、または法令上必要な場合は個別に確認します。",
      "申請方法",
      "購入時のメールアドレス、決済日、金額、理由を問い合わせ窓口へ送信してください。Stripe上の記録を確認して回答します。",
    ],
    cookie: [
      "Cookieポリシー",
      "本サービスはログイン状態と安全性を維持するためCookieを使用します。",
      "必須Cookie",
      "認証セッション、CSRF対策、表示言語の維持に必要なCookieおよびブラウザ保存領域だけを使用します。",
      "分析・広告",
      "初期公開時点では広告Cookieや第三者行動追跡Cookieを使用しません。導入する場合は本ページを更新します。",
    ],
    contact: [
      "お問い合わせ",
      "会員登録、決済、残高、通訳の不具合についてお問い合わせいただけます。",
      "窓口",
      "下記メールアドレスへ、登録メールアドレスと状況をお送りください。パスワード、カード番号、APIキーは送信しないでください。",
    ],
  },
  en: {
    refund: [
      "Refund and Cancellation Policy",
      "Review the product and included time before purchase.",
      "Refunds",
      "Used interpretation time is non-refundable due to the nature of the service. We review duplicate charges, unused time affected by our service failure, and remedies required by law.",
      "How to request",
      "Email the account address, payment date, amount, and reason to support. We will verify the Stripe record.",
    ],
    cookie: [
      "Cookie Policy",
      "We use cookies to maintain sign-in and protect the service.",
      "Essential cookies",
      "Only authentication sessions, CSRF protection, language preferences, and necessary browser storage are used.",
      "Analytics and advertising",
      "At initial launch we do not use advertising or third-party behavioral tracking cookies. This page will be updated before any such use.",
    ],
    contact: [
      "Contact",
      "Contact us about signup, payments, balances, or interpretation problems.",
      "Support",
      "Email the address below with your account email and a description. Never send passwords, card numbers, or API keys.",
    ],
  },
  "zh-CN": {
    refund: [
      "退款与取消政策",
      "购买前请确认商品内容和口译时长。",
      "退款",
      "由于服务性质，已使用的口译时间不予退款。重复扣款、因本站故障未能使用的剩余时间以及法律要求的情况将另行审核。",
      "申请方式",
      "请将账户邮箱、付款日期、金额和原因发送至客服，我们会核对Stripe记录。",
    ],
    cookie: [
      "Cookie政策",
      "本站使用Cookie维持登录状态并保护服务安全。",
      "必要Cookie",
      "仅使用身份验证、CSRF防护、语言设置及必要的浏览器存储。",
      "分析与广告",
      "初次发布时不使用广告Cookie或第三方行为追踪Cookie。如将来使用，会事先更新本页。",
    ],
    contact: [
      "联系我们",
      "可就注册、付款、余额或口译故障联系我们。",
      "客服",
      "请通过下方邮箱发送账户邮箱和问题说明。请勿发送密码、银行卡号或API密钥。",
    ],
  },
} as const;
export function LegalPage({ kind, locale }: { kind: Kind; locale: Locale }) {
  const [legal, setLegal] = useState<Record<string, string | null>>({});
  useEffect(() => {
    api<{ legal: Record<string, string | null> }>("public-config.php")
      .then((r) => setLegal(r.legal))
      .catch(() => {});
  }, []);
  const t = content[locale];
  if (kind === "refund" || kind === "cookie" || kind === "contact") {
    const sections = supplemental[locale][kind];
    return (
      <article className="legal-page">
        <h1>{sections[0]}</h1>
        <p>{sections[1]}</p>
        {Array.from({ length: (sections.length - 2) / 2 }, (_, i) => (
          <section key={i}>
            <h2>{sections[2 + i * 2]}</h2>
            <p>{sections[3 + i * 2]}</p>
          </section>
        ))}
        {kind === "contact" && (
          <p>
            <a href={`mailto:${legal.email || ""}`}>{legal.email || "—"}</a>
          </p>
        )}
        <p>Japanese version is the legally controlling version.</p>
      </article>
    );
  }
  if (kind === "commercial-disclosure") {
    const c = t.commercial;
    return (
      <article className="legal-page">
        <h1>{c[0]}</h1>
        <dl>
          <dt>{c[1]}</dt>
          <dd>{legal.seller_name || "—"}</dd>
          <dt>{c[2]}</dt>
          <dd>ShalomWorks</dd>
          <dt>{c[3]}</dt>
          <dd>{legal.address || "—"}</dd>
          <dt>{c[4]}</dt>
          <dd>{legal.phone || "—"}</dd>
          <dt>{c[5]}</dt>
          <dd>{legal.email || "—"}</dd>
          <dt>{c[6]}</dt>
          <dd>{c[7]}</dd>
          <dt>{c[8]}</dt>
          <dd>{c[9]}</dd>
          <dt>{c[10]}</dt>
          <dd>{c[11]}</dd>
          <dt>{c[12]}</dt>
          <dd>{c[13]}</dd>
        </dl>
        <p>Japanese version is the legally controlling version.</p>
      </article>
    );
  }
  const sections = kind === "terms" ? t.terms : t.privacy;
  return (
    <article className="legal-page">
      <h1>{sections[0]}</h1>
      <p>{sections[1]}</p>
      {Array.from({ length: (sections.length - 2) / 2 }, (_, i) => (
        <section key={i}>
          <h2>{sections[2 + i * 2]}</h2>
          <p>{sections[3 + i * 2]}</p>
        </section>
      ))}
      <p>Japanese version is the legally controlling version.</p>
    </article>
  );
}
