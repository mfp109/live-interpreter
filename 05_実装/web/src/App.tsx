import { ArrowRight, AudioLines, Check, Globe2, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type Locale = "ja" | "en" | "zh-CN";
const copy = {
  ja: { navHow:"使い方",navPrice:"料金",navFaq:"よくある質問",login:"ログイン",cta:"15分無料で試す",eyebrow:"声が届けば、心も届く。",hero:"話した言葉を、\nそのまま世界へ。",lead:"マイクに話すだけ。低遅延のAI音声通訳が、あなたの声を別の言語へ届けます。字幕を読む必要はありません。",demo:"実際の通訳を見る",trial:"登録後15分無料",card:"ブラウザで今すぐ通訳",from:"入力言語",to:"出力言語",start:"無料で始める",why:"伝えたい瞬間を、待たせない。",price:"必要な時間だけ購入",notice:"音声と翻訳内容は原則保存しません。"},
  en: { navHow:"How it works",navPrice:"Pricing",navFaq:"FAQ",login:"Sign in",cta:"Try 15 minutes free",eyebrow:"When your voice reaches them, your heart can too.",hero:"Speak naturally.\nBe heard worldwide.",lead:"Just speak into your microphone. Low-latency AI interpretation carries your voice into another language—no subtitles to follow.",demo:"Watch a real demo",trial:"15 free minutes after signup",card:"Interpret now in your browser",from:"Input language",to:"Output language",start:"Start for free",why:"Keep the moment moving.",price:"Buy only the time you need",notice:"We do not normally store audio or translated content."},
  "zh-CN": { navHow:"使用方法",navPrice:"价格",navFaq:"常见问题",login:"登录",cta:"免费试用15分钟",eyebrow:"声音传达，心意也能传达。",hero:"自然说话，\n让世界听见。",lead:"只需对着麦克风说话。低延迟AI语音口译会将您的声音转换成另一种语言，无需阅读字幕。",demo:"观看真实演示",trial:"注册后免费15分钟",card:"立即在浏览器中口译",from:"输入语言",to:"输出语言",start:"免费开始",why:"让沟通无需等待。",price:"只购买需要的时间",notice:"原则上不保存音频或翻译内容。"}
} as const;

const products = [{name:"Starter",minutes:60,price:"¥1,500"},{name:"Standard",minutes:300,price:"¥5,500",popular:true},{name:"Event",minutes:1000,price:"¥15,000"}];

export function App(){
  const [locale,setLocale]=useState<Locale>("ja");
  const t=copy[locale];
  const heroLines=useMemo(()=>t.hero.split("\n"),[t.hero]);
  return <div className="site">
    <header><a className="brand" href="#"><span className="brand-mark"><AudioLines size={22}/></span><span>ShalomWorks <b>Live Interpreter</b></span></a><nav><a href="#how">{t.navHow}</a><a href="#pricing">{t.navPrice}</a><a href="#faq">{t.navFaq}</a></nav><div className="header-actions"><label className="locale"><Globe2 size={16}/><select value={locale} onChange={e=>setLocale(e.target.value as Locale)}><option value="ja">日本語</option><option value="en">English</option><option value="zh-CN">简体中文</option></select></label><button className="link-button">{t.login}</button><button className="primary small">{t.cta}</button></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><Sparkles size={16}/>{t.eyebrow}</p><h1>{heroLines.map((line,i)=><span key={line}>{line}{i===0&&<br/>}</span>)}</h1><p className="lead">{t.lead}</p><div className="hero-actions"><button className="primary">{t.cta}<ArrowRight size={19}/></button><button className="secondary">▶ {t.demo}</button></div><p className="trial"><Check size={16}/>{t.trial}<span>•</span><ShieldCheck size={16}/>{t.notice}</p></div>
        <div className="interpreter-card"><div className="card-top"><div><span className="live-dot"/> LIVE INTERPRETER</div><span className="balance">15:00 FREE</span></div><h2>{t.card}</h2><div className="language-row"><label>{t.from}<select><option>日本語</option><option>English</option><option>中文</option></select></label><span className="swap">→</span><label>{t.to}<select><option>English</option><option>日本語</option><option>中文</option></select></label></div><div className="wave" aria-label="microphone level">{Array.from({length:28},(_,i)=><i key={i} style={{height:`${16+((i*17)%48)}px`}}/>)}</div><button className="start"><span className="mic">●</span>{t.start}</button><p><Headphones size={15}/> Headphones recommended</p></div>
      </section>
      <section className="trust"><span>FOR CHURCHES</span><span>EVENTS</span><span>EDUCATION</span><span>TRAVEL</span><span>CUSTOMER SUPPORT</span></section>
      <section id="how" className="section"><p className="section-kicker">WHY LIVE INTERPRETER</p><h2>{t.why}</h2><div className="features"><article><b>01</b><h3>Speak</h3><p>Choose your microphone and speak naturally.</p></article><article><b>02</b><h3>Interpret</h3><p>AI translates speech continuously with low latency.</p></article><article><b>03</b><h3>Listen</h3><p>Your audience hears a natural voice in their language.</p></article></div></section>
      <section id="pricing" className="section pricing"><p className="section-kicker">SIMPLE PRICING</p><h2>{t.price}</h2><div className="plans">{products.map(p=><article className={p.popular?"popular":""} key={p.name}>{p.popular&&<span className="badge">MOST POPULAR</span>}<h3>{p.name}</h3><strong>{p.price}</strong><p>{p.minutes.toLocaleString()} minutes</p><button className={p.popular?"primary":"secondary"}>Choose plan</button></article>)}</div></section>
    </main><footer><span>© 2026 ShalomWorks</span><span>Terms · Privacy · Commercial Disclosure</span></footer>
  </div>
}
