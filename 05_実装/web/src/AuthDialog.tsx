import { FormEvent, useState } from "react";
import { api } from "./api";

const text = {
  ja: {
    login: "ログイン",
    register: "無料会員登録",
    loginLead: "通訳時間と購入履歴を確認できます。",
    registerLead: "メール確認後、1分の無料通訳時間を付与します。",
    email: "メールアドレス",
    password: "パスワード",
    accept: "利用規約とプライバシーポリシーに同意します",
    age: "18歳未満の方は、保護者の同意を得て登録してください。",
    busy: "処理中…",
    registerButton: "1分無料で登録",
    forgot: "パスワードを忘れた方",
    newUser: "初めての方はこちら",
    existing: "すでに登録済みの方はこちら",
    sent: "確認メールを送信しました。メール内のリンクを開いてください。",
    resetSent: "登録がある場合、再設定メールを送信しました。",
    enterEmail: "メールアドレスを入力してください。",
    factor: "2段階認証",
    factorLead: "認証アプリに表示される6桁のコードを入力してください。",
    code: "確認コード",
    verify: "確認する",
    error: "エラーが発生しました。",
  },
  en: {
    login: "Sign in",
    register: "Create free account",
    loginLead: "View your interpretation time and purchase history.",
    registerLead: "Receive 1 free minute after email verification.",
    email: "Email address",
    password: "Password",
    accept: "I agree to the Terms and Privacy Policy",
    age: "If you are under 18, register only with a parent or guardian's consent.",
    busy: "Working…",
    registerButton: "Create account — 1 min free",
    forgot: "Forgot password",
    newUser: "Create an account",
    existing: "Already have an account",
    sent: "Verification email sent. Open the link in the email.",
    resetSent: "If the account exists, a reset email was sent.",
    enterEmail: "Enter your email address.",
    factor: "Two-factor authentication",
    factorLead: "Enter the 6-digit code from your authenticator app.",
    code: "Verification code",
    verify: "Verify",
    error: "Something went wrong.",
  },
  "zh-CN": {
    login: "登录",
    register: "免费注册",
    loginLead: "查看口译时间和购买记录。",
    registerLead: "邮箱验证后可获得1分钟免费时间。",
    email: "电子邮箱",
    password: "密码",
    accept: "我同意使用条款和隐私政策",
    age: "未满18岁者请在取得父母或监护人同意后注册。",
    busy: "处理中…",
    registerButton: "免费注册并获得1分钟",
    forgot: "忘记密码",
    newUser: "创建账户",
    existing: "已有账户",
    sent: "验证邮件已发送，请打开邮件中的链接。",
    resetSent: "如果账户存在，重置邮件已发送。",
    enterEmail: "请输入电子邮箱。",
    factor: "两步验证",
    factorLead: "请输入身份验证器中的6位代码。",
    code: "验证码",
    verify: "确认",
    error: "发生错误。",
  },
} as const;

export function AuthDialog({
  mode,
  onClose,
  onSignedIn,
  locale,
}: {
  mode: "login" | "register";
  onClose: () => void;
  onSignedIn: () => void;
  locale: string;
}) {
  const [kind, setKind] = useState(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [code, setCode] = useState("");
  const [csrf, setCsrf] = useState("");
  const t = text[(locale in text ? locale : "en") as keyof typeof text];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (kind === "register") {
        await api("auth/register.php", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            locale,
            accept_terms: accepted,
          }),
        });
        setMessage(t.sent);
      } else {
        const result = await api<{ requires_2fa: boolean; csrf_token: string }>(
          "auth/login.php",
          { method: "POST", body: JSON.stringify({ email, password }) },
        );
        if (result.requires_2fa) {
          setCsrf(result.csrf_token);
          setTwoFactor(true);
          return;
        }
        onSignedIn();
        onClose();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.error);
    } finally {
      setBusy(false);
    }
  }
  async function verify2fa(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(
        "auth/verify-2fa.php",
        { method: "POST", body: JSON.stringify({ code }) },
        csrf,
      );
      onSignedIn();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.error);
    } finally {
      setBusy(false);
    }
  }
  async function forgot() {
    if (!email) {
      setMessage(t.enterEmail);
      return;
    }
    setBusy(true);
    try {
      await api("auth/forgot-password.php", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(t.resetSent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.error);
    } finally {
      setBusy(false);
    }
  }
  if (twoFactor)
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <form className="auth-dialog" onSubmit={verify2fa}>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
          <p className="section-kicker">ADMIN SECURITY</p>
          <h2>{t.factor}</h2>
          <p>{t.factorLead}</p>
          <label>
            {t.code}
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </label>
          <button className="primary auth-submit" disabled={busy}>
            {t.verify}
          </button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </div>
    );
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="auth-dialog" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <p className="section-kicker">SHALOMWORKS</p>
        <h2>{kind === "login" ? t.login : t.register}</h2>
        <p>{kind === "login" ? t.loginLead : t.registerLead}</p>
        <label>
          {t.email}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          {t.password}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            autoComplete={
              kind === "login" ? "current-password" : "new-password"
            }
          />
        </label>
        {kind === "register" && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                required
              />
              {t.accept}
            </label>
            <small className="age-notice">{t.age}</small>
          </>
        )}
        <button className="primary auth-submit" disabled={busy}>
          {busy ? t.busy : kind === "login" ? t.login : t.registerButton}
        </button>
        {message && <p className="form-message">{message}</p>}
        {kind === "login" && (
          <button type="button" className="switch-auth" onClick={forgot}>
            {t.forgot}
          </button>
        )}
        <button
          type="button"
          className="switch-auth"
          onClick={() => {
            setKind(kind === "login" ? "register" : "login");
            setMessage("");
          }}
        >
          {kind === "login" ? t.newUser : t.existing}
        </button>
      </form>
    </div>
  );
}
