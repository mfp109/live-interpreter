import { FormEvent, useEffect, useState } from "react";
import { api, formatTime } from "./api";
import type { Locale } from "./locales";
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
  es: {
    history: "Historial de compras y uso",
    purchases: "Compras",
    sessions: "Sesiones de interpretación",
    none: "Aún no hay historial",
    settings: "Configuración de la cuenta",
    email: "Nuevo correo electrónico",
    emailButton: "Enviar correo de verificación",
    current: "Contraseña actual",
    next: "Nueva contraseña (12+ caracteres)",
    passwordButton: "Cambiar contraseña",
    delete: "Eliminar cuenta",
    deleteConfirm:
      "Eliminar la cuenta detendrá el acceso y la interpretación. Escribe DELETE para confirmar.",
    sent: "Correo de verificación enviado.",
    changed: "Contraseña actualizada.",
    used: "Usado",
  },
  pt: {
    history: "Histórico de compras e uso",
    purchases: "Compras",
    sessions: "Sessões de interpretação",
    none: "Ainda não há histórico",
    settings: "Configurações da conta",
    email: "Novo e-mail",
    emailButton: "Enviar e-mail de verificação",
    current: "Senha atual",
    next: "Nova senha (12+ caracteres)",
    passwordButton: "Alterar senha",
    delete: "Excluir conta",
    deleteConfirm:
      "A exclusão interrompe o acesso e a interpretação. Digite DELETE para confirmar.",
    sent: "E-mail de verificação enviado.",
    changed: "Senha alterada.",
    used: "Usado",
  },
  fr: {
    history: "Historique des achats et de l’utilisation",
    purchases: "Achats",
    sessions: "Sessions d’interprétation",
    none: "Aucun historique",
    settings: "Paramètres du compte",
    email: "Nouvelle adresse e-mail",
    emailButton: "Envoyer l’e-mail de vérification",
    current: "Mot de passe actuel",
    next: "Nouveau mot de passe (12 caractères minimum)",
    passwordButton: "Modifier le mot de passe",
    delete: "Supprimer le compte",
    deleteConfirm:
      "La suppression arrête la connexion et l’interprétation. Saisissez DELETE pour confirmer.",
    sent: "E-mail de vérification envoyé.",
    changed: "Mot de passe modifié.",
    used: "Utilisé",
  },
  de: {
    history: "Kauf- und Nutzungsverlauf",
    purchases: "Käufe",
    sessions: "Dolmetschsitzungen",
    none: "Noch kein Verlauf",
    settings: "Kontoeinstellungen",
    email: "Neue E-Mail-Adresse",
    emailButton: "Bestätigungs-E-Mail senden",
    current: "Aktuelles Passwort",
    next: "Neues Passwort (mindestens 12 Zeichen)",
    passwordButton: "Passwort ändern",
    delete: "Konto löschen",
    deleteConfirm:
      "Beim Löschen werden Anmeldung und Dolmetschen beendet. Zur Bestätigung DELETE eingeben.",
    sent: "Bestätigungs-E-Mail gesendet.",
    changed: "Passwort geändert.",
    used: "Genutzt",
  },
  ru: {
    history: "История покупок и использования",
    purchases: "Покупки",
    sessions: "Сеансы перевода",
    none: "Истории пока нет",
    settings: "Настройки аккаунта",
    email: "Новый адрес эл. почты",
    emailButton: "Отправить письмо для подтверждения",
    current: "Текущий пароль",
    next: "Новый пароль (от 12 символов)",
    passwordButton: "Изменить пароль",
    delete: "Удалить аккаунт",
    deleteConfirm:
      "Удаление остановит вход и перевод. Введите DELETE для подтверждения.",
    sent: "Письмо отправлено.",
    changed: "Пароль изменён.",
    used: "Использовано",
  },
  ko: {
    history: "구매 및 이용 내역",
    purchases: "구매 내역",
    sessions: "통역 내역",
    none: "아직 내역이 없습니다",
    settings: "계정 설정",
    email: "새 이메일 주소",
    emailButton: "확인 메일 보내기",
    current: "현재 비밀번호",
    next: "새 비밀번호(12자 이상)",
    passwordButton: "비밀번호 변경",
    delete: "계정 삭제",
    deleteConfirm:
      "계정을 삭제하면 로그인과 통역이 중지됩니다. 확인하려면 DELETE를 입력하세요.",
    sent: "확인 메일을 보냈습니다.",
    changed: "비밀번호를 변경했습니다.",
    used: "사용",
  },
  hi: {
    history: "खरीद और उपयोग इतिहास",
    purchases: "खरीद",
    sessions: "दुभाषिया सत्र",
    none: "अभी कोई इतिहास नहीं",
    settings: "खाता सेटिंग",
    email: "नया ईमेल पता",
    emailButton: "सत्यापन ईमेल भेजें",
    current: "वर्तमान पासवर्ड",
    next: "नया पासवर्ड (12+ अक्षर)",
    passwordButton: "पासवर्ड बदलें",
    delete: "खाता हटाएँ",
    deleteConfirm:
      "खाता हटाने से लॉगिन और दुभाषिया सेवा बंद हो जाएगी। पुष्टि के लिए DELETE लिखें।",
    sent: "सत्यापन ईमेल भेजा गया।",
    changed: "पासवर्ड बदल दिया गया।",
    used: "उपयोग",
  },
  id: {
    history: "Riwayat pembelian dan penggunaan",
    purchases: "Pembelian",
    sessions: "Sesi interpretasi",
    none: "Belum ada riwayat",
    settings: "Pengaturan akun",
    email: "Alamat email baru",
    emailButton: "Kirim email verifikasi",
    current: "Kata sandi saat ini",
    next: "Kata sandi baru (12+ karakter)",
    passwordButton: "Ubah kata sandi",
    delete: "Hapus akun",
    deleteConfirm:
      "Menghapus akun akan menghentikan login dan interpretasi. Ketik DELETE untuk mengonfirmasi.",
    sent: "Email verifikasi dikirim.",
    changed: "Kata sandi diubah.",
    used: "Digunakan",
  },
  vi: {
    history: "Lịch sử mua và sử dụng",
    purchases: "Lịch sử mua",
    sessions: "Phiên phiên dịch",
    none: "Chưa có lịch sử",
    settings: "Cài đặt tài khoản",
    email: "Địa chỉ email mới",
    emailButton: "Gửi email xác minh",
    current: "Mật khẩu hiện tại",
    next: "Mật khẩu mới (từ 12 ký tự)",
    passwordButton: "Đổi mật khẩu",
    delete: "Xóa tài khoản",
    deleteConfirm:
      "Xóa tài khoản sẽ dừng đăng nhập và phiên dịch. Nhập DELETE để xác nhận.",
    sent: "Đã gửi email xác minh.",
    changed: "Đã đổi mật khẩu.",
    used: "Đã dùng",
  },
  it: {
    history: "Cronologia acquisti e utilizzo",
    purchases: "Acquisti",
    sessions: "Sessioni di interpretazione",
    none: "Nessuna cronologia",
    settings: "Impostazioni account",
    email: "Nuovo indirizzo email",
    emailButton: "Invia email di verifica",
    current: "Password attuale",
    next: "Nuova password (almeno 12 caratteri)",
    passwordButton: "Cambia password",
    delete: "Elimina account",
    deleteConfirm:
      "L’eliminazione interrompe accesso e interpretazione. Digita DELETE per confermare.",
    sent: "Email di verifica inviata.",
    changed: "Password modificata.",
    used: "Utilizzato",
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
  const t = text[(locale in text ? locale : "en") as keyof typeof text];
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
