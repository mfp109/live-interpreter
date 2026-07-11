import { FormEvent, useEffect, useState } from "react";
import { api, formatTime } from "./api";

type Stats = {
  members: number;
  verified_members: number;
  revenue_jpy: number;
  paid_seconds_outstanding: number;
  trial_seconds_outstanding: number;
  seconds_used: number;
  sessions_today: number;
  stripe_fee_estimate_jpy: number;
  openai_cost_estimate_jpy: number;
  gross_profit_estimate_jpy: number;
};
type Member = {
  id: string;
  email: string;
  status: string;
  email_verified_at: string | null;
  trial_seconds: number;
  paid_seconds: number;
  created_at: string;
};
export function AdminPanel({ csrf }: { csrf: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const [dashboard, members] = await Promise.all([
      api<{ stats: Stats }>("admin/dashboard.php"),
      api<{ users: Member[] }>("admin/users.php"),
    ]);
    setStats(dashboard.stats);
    setUsers(members.users);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function search(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ users: Member[] }>(
        `admin/users.php?q=${encodeURIComponent(query)}`,
      );
      setUsers(result.users);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "検索できませんでした。");
    }
  }
  async function adjust(user: Member) {
    const minutes = prompt(`${user.email} に追加する分数（減算はマイナス）`);
    if (minutes === null) return;
    const reason = prompt("調整理由（5文字以上）");
    if (!reason) return;
    try {
      await api(
        "admin/adjust-balance.php",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: user.id,
            paid_seconds_delta: Math.round(Number(minutes) * 60),
            reason,
          }),
        },
        csrf,
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "調整できませんでした。");
    }
  }
  async function status(user: Member) {
    const next = user.status === "active" ? "disabled" : "active";
    if (!confirm(`${user.email} を ${next} に変更しますか？`)) return;
    try {
      await api(
        "admin/set-user-status.php",
        {
          method: "POST",
          body: JSON.stringify({ user_id: user.id, status: next }),
        },
        csrf,
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "変更できませんでした。");
    }
  }
  return (
    <section className="admin-panel">
      <div className="app-heading">
        <div>
          <p className="section-kicker">ADMIN CONSOLE</p>
          <h2>運営ダッシュボード</h2>
        </div>
      </div>
      {message && <p className="form-message">{message}</p>}
      {stats && (
        <div className="stat-grid">
          <article>
            <span>会員</span>
            <strong>{stats.members.toLocaleString()}</strong>
            <small>認証済 {stats.verified_members}</small>
          </article>
          <article>
            <span>売上</span>
            <strong>¥{stats.revenue_jpy.toLocaleString()}</strong>
          </article>
          <article>
            <span>概算粗利益</span>
            <strong>¥{stats.gross_profit_estimate_jpy.toLocaleString()}</strong>
            <small>API ¥{stats.openai_cost_estimate_jpy.toLocaleString()} / 決済 ¥{stats.stripe_fee_estimate_jpy.toLocaleString()}</small>
          </article>
          <article>
            <span>利用済み</span>
            <strong>{formatTime(stats.seconds_used)}</strong>
          </article>
          <article>
            <span>未使用有料時間</span>
            <strong>{formatTime(stats.paid_seconds_outstanding)}</strong>
          </article>
          <article>
            <span>本日のセッション</span>
            <strong>{stats.sessions_today}</strong>
          </article>
        </div>
      )}
      <form className="admin-search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="メールアドレスで検索"
        />
        <button className="secondary">検索</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>会員</th>
              <th>状態</th>
              <th>無料</th>
              <th>有料</th>
              <th>登録日</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.email}
                  <small>{user.email_verified_at ? "認証済" : "未認証"}</small>
                </td>
                <td>{user.status}</td>
                <td>{formatTime(Number(user.trial_seconds))}</td>
                <td>{formatTime(Number(user.paid_seconds))}</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => adjust(user)}>残高調整</button>
                  <button onClick={() => status(user)}>
                    {user.status === "active" ? "停止" : "再開"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
