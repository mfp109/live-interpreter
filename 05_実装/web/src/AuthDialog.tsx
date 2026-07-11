import { FormEvent, useState } from "react";
import { api } from "./api";

export function AuthDialog({mode,onClose,onSignedIn,locale}:{mode:"login"|"register";onClose:()=>void;onSignedIn:()=>void;locale:string}){
  const [kind,setKind]=useState(mode); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [accepted,setAccepted]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setMessage("");try{
    if(kind==="register") { await api("auth/register.php",{method:"POST",body:JSON.stringify({email,password,locale,accept_terms:accepted})}); setMessage("確認メールを送信しました。メール内のリンクを開いてください。"); }
    else { await api("auth/login.php",{method:"POST",body:JSON.stringify({email,password})}); onSignedIn(); onClose(); }
  }catch(error){setMessage(error instanceof Error?error.message:"エラーが発生しました。")}finally{setBusy(false)}}
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="auth-dialog" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}>×</button><p className="section-kicker">SHALOMWORKS</p><h2>{kind==="login"?"ログイン":"無料会員登録"}</h2><p>{kind==="login"?"通訳時間と購入履歴を確認できます。":"メール確認後、15分の無料通訳時間を付与します。"}</p><label>メールアドレス<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>パスワード<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} autoComplete={kind==="login"?"current-password":"new-password"}/></label>{kind==="register"&&<label className="check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required/>利用規約とプライバシーポリシーに同意します</label>}<button className="primary auth-submit" disabled={busy}>{busy?"処理中…":kind==="login"?"ログイン":"15分無料で登録"}</button>{message&&<p className="form-message">{message}</p>}<button type="button" className="switch-auth" onClick={()=>{setKind(kind==="login"?"register":"login");setMessage("")}}>{kind==="login"?"初めての方はこちら":"すでに登録済みの方はこちら"}</button></form></div>
}
