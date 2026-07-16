import { FormEvent, useState } from "react";
import { api } from "./api";
import type { Locale } from "./locales";
const text = {
  ja: {
    title: "パスワード再設定",
    label: "新しいパスワード（12文字以上）",
    button: "パスワードを変更",
    done: "パスワードを変更しました。トップページからログインしてください。",
  },
  en: {
    title: "Reset password",
    label: "New password (12+ characters)",
    button: "Change password",
    done: "Password changed. Return to the home page and sign in.",
  },
  "zh-CN": {
    title: "重置密码",
    label: "新密码（至少12个字符）",
    button: "修改密码",
    done: "密码已修改，请返回首页登录。",
  },
} as const;
export function ResetPassword({
  token,
  locale,
}: {
  token: string;
  locale: Locale;
}) {
  const t = text[(locale in text ? locale : "en") as keyof typeof text];
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("auth/reset-password.php", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setMessage(t.done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error");
    }
  }
  return (
    <main className="standalone-page">
      <form className="auth-dialog reset-card" onSubmit={submit}>
        <p className="section-kicker">ACCOUNT SECURITY</p>
        <h2>{t.title}</h2>
        <label>
          {t.label}
          <input
            type="password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </label>
        <button className="primary auth-submit">{t.button}</button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </main>
  );
}
