import { FormEvent, useEffect, useState } from "react";
import { api, formatTime } from "./api";
type Locale = "ja" | "en" | "zh-CN";
const text = {
  ja: {
    history: "購入・利用履歴",
    purchases: "購入履歴",
    sessions: "通訳履歴",
    none: "履歴はありません",
    settings: "アカウント設定",
    email: "新しいメールアドレス",
    emailButton: "確認メールを送る",
    current: "現在のパスワード",
    next: "新しいパスワード（12文字以上）",
    passwordButton: "パスワードを変更",
    delete: "退会する",
    deleteConfirm:
      "退会するとログインと通訳が停止します。「DELETE」と入力してください。",
    sent: "確認メールを送信しました。",
    changed: "パスワードを変更しました。",
    used: "利用",
  },
  en: {
    history: "Purchase and usage history",
    purchases: "Purchases",
    sessions: "Interpretation sessions",
    none: "No history yet",
    settings: "Account settings",
    email: "New email address",
    emailButton: "Send verification email",
    current: "Current password",
    next: "New password (12+ characters)",
    passwordButton: "Change password",
    delete: "Delete account",
    deleteConfirm:
      "Deleting your account stops sign-in and interpretation. Type DELETE to confirm.",
    sent: "Verification email sent.",
    changed: "Password changed.",
    used: "Used",
  },
  "zh-CN": {
    history: "购买和使用记录",
    purchases: "购买记录",
    sessions: "口译记录",
    none: "暂无记录",
    settings: "账户设置",
    email: "新电子邮箱",
    emailButton: "发送验证邮件",
    current: "当前密码",
    next: "新密码（至少12个字符）",
    passwordButton: "修改密码",
    delete: "注销账户",
    deleteConfirm: "注销后将无法登录和使用口译。请输入 DELETE 确认。",
    sent: "验证邮件已发送。",
    changed: "密码已修改。",
    used: "已使用",
  },
} as const;
type Payment = {
  id: string;
  code: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: string;
};
type Session = {
  id: string;
  source_language: string;
  target_language: string;
  status: string;
  trial_seconds_used: number;
  paid_seconds_used: number;
  created_at: string;
};
export function AccountTools({
  locale,
  csrf,
  onDeleted,
}: {
  locale: Locale;
  csrf: string;
  onDeleted: () => void;
}) {
  const t = text[locale];
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api<{ payments: Payment[]; sessions: Session[] }>("history.php")
      .then((result) => {
        setPayments(result.payments);
        setSessions(result.sessions);
      })
      .catch((error) => setMessage(error.message));
  }, []);
  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    try {
      await api(
        "account/change-email.php",
        { method: "POST", body: JSON.stringify({ email }) },
        csrf,
      );
      setMessage(t.sent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error");
    }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    try {
      await api(
        "account/change-password.php",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: current,
            new_password: next,
          }),
        },
        csrf,
      );
      setMessage(t.changed);
      setCurrent("");
      setNext("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error");
    }
  }
  async function remove() {
    const value = prompt(t.deleteConfirm);
    if (value !== "DELETE") return;
    try {
      await api(
        "auth/delete-account.php",
        { method: "POST", body: JSON.stringify({ confirm: "DELETE" }) },
        csrf,
      );
      onDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error");
    }
  }
  return (
    <section className="account-tools">
      {message && <p className="form-message">{message}</p>}
      <h2>{t.history}</h2>
      <div className="history-grid">
        <article>
          <h3>{t.purchases}</h3>
          {payments.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            payments.map((payment) => (
              <div className="history-row" key={payment.id}>
                <span>
                  {payment.code}
                  <small>
                    {new Date(payment.created_at).toLocaleDateString(locale)}
                  </small>
                </span>
                <strong>
                  ¥{Number(payment.amount_minor).toLocaleString(locale)}
                  <small>{payment.status}</small>
                </strong>
              </div>
            ))
          )}
        </article>
        <article>
          <h3>{t.sessions}</h3>
          {sessions.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            sessions.map((session) => (
              <div className="history-row" key={session.id}>
                <span>
                  {session.source_language.toUpperCase()} →{" "}
                  {session.target_language.toUpperCase()}
                  <small>
                    {new Date(session.created_at).toLocaleDateString(locale)}
                  </small>
                </span>
                <strong>
                  {formatTime(
                    Number(session.trial_seconds_used) +
                      Number(session.paid_seconds_used),
                  )}
                  <small>{t.used}</small>
                </strong>
              </div>
            ))
          )}
        </article>
      </div>
      <h2>{t.settings}</h2>
      <div className="settings-grid">
        <form onSubmit={changeEmail}>
          <label>
            {t.email}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="secondary">{t.emailButton}</button>
        </form>
        <form onSubmit={changePassword}>
          <label>
            {t.current}
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </label>
          <label>
            {t.next}
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={12}
              required
            />
          </label>
          <button className="secondary">{t.passwordButton}</button>
        </form>
      </div>
      <button className="danger-link" onClick={remove}>
        {t.delete}
      </button>
    </section>
  );
}
