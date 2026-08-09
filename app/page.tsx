"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthUser, beginSignIn, finishSignIn, signOut } from "./cognito-auth";

type Tab = "home" | "plan" | "review" | "notes" | "mistakes";

const tasks = [
  { time: "07:30", title: "英単語 50語", meta: "英語 · 25分", tone: "blue", done: true },
  { time: "19:00", title: "二次関数｜応用問題", meta: "数学 · 45分", tone: "coral", done: false },
  { time: "20:00", title: "世界史：産業革命", meta: "世界史 · 30分", tone: "mint", done: false },
];

const weakGroups = [
  { title: "場合分けの見落とし", subject: "数学", count: 6, color: "coral" },
  { title: "時制の一致", subject: "英語", count: 4, color: "blue" },
  { title: "年代の前後関係", subject: "世界史", count: 3, color: "mint" },
];

export default function Home() {
  const [active, setActive] = useState<Tab>("home");
  const [checked, setChecked] = useState([true, false, false]);
  const [aiOpen, setAiOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const completed = checked.filter(Boolean).length;
  const progress = Math.round((completed / checked.length) * 100);
  const today = useMemo(() => new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date()), []);

  useEffect(() => {
    finishSignIn().then(setAuthUser).catch((error: Error) => setAuthError(error.message)).finally(() => setAuthLoading(false));
  }, []);

  const toggle = (index: number) => setChecked((current) => current.map((value, i) => i === index ? !value : value));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>Manabi</span></div>
        <nav aria-label="メインナビゲーション">
          <Nav id="home" icon="⌂" label="ホーム" active={active} onClick={setActive} />
          <Nav id="plan" icon="□" label="学習プラン" active={active} onClick={setActive} />
          <Nav id="review" icon="↻" label="振り返り" active={active} onClick={setActive} />
          <Nav id="notes" icon="≡" label="要点ノート" active={active} onClick={setActive} />
          <Nav id="mistakes" icon="◇" label="苦手グループ" active={active} onClick={setActive} />
        </nav>
        <div className="sidebar-bottom">
          <div className="streak"><span>🔥</span><div><strong>12日連続</strong><small>学習を継続中</small></div></div>
          <button className="profile" type="button" onClick={() => authUser ? signOut() : beginSignIn()}><span className="avatar">{authUser?.name.slice(0, 1) ?? "M"}</span><span><strong>{authUser?.name ?? "ゲスト"}</strong><small>{authUser?.email ?? "サインインしてください"}</small></span><b>···</b></button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p>{today}</p><h1>{authUser ? `おかえりなさい、${authUser.name}さん。` : "あなたの学びを、今日も一歩。"}</h1>{authError && <p className="auth-error">{authError}</p>}</div>
          <div className="top-actions"><button className="auth-button" disabled={authLoading} onClick={() => authUser ? signOut() : beginSignIn()}>{authLoading ? "確認中…" : authUser ? "ログアウト" : "ログイン"}</button><button className="icon-button" aria-label="通知">♢<i /></button><button className="primary" onClick={() => setActive("plan")}>＋ 今日の予定を追加</button></div>
        </header>

        <section className="hero-grid">
          <article className="focus-card">
            <div className="eyebrow">TODAY&apos;S FOCUS</div>
            <h2>今日やることを、<br />ひとつずつ。</h2>
            <p>計画の <strong>{completed}/{checked.length}</strong> が完了しました。いいペースです。</p>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-label"><span>{progress}% 完了</span><span>残り {checked.length - completed} タスク</span></div>
            <div className="orbit" aria-hidden="true"><span className="orbit-number">{progress}</span><small>%</small></div>
          </article>
          <article className="week-card">
            <div className="card-heading"><div><span className="eyebrow dark">THIS WEEK</span><h3>今週の学習</h3></div><button>詳細 →</button></div>
            <div className="week-metrics"><div><strong>8.5</strong><span>時間</span><small>目標 10時間</small></div><div><strong>24</strong><span>完了</span><small>先週比 +6</small></div></div>
            <div className="bars" aria-label="曜日ごとの学習量">{[40,66,52,88,70,35,20].map((h,i)=><div key={i}><span style={{height:`${h}%`}} className={i === 3 ? "today-bar" : ""}/><small>{"月火水木金土日"[i]}</small></div>)}</div>
          </article>
        </section>

        <section className="lower-grid">
          <article className="panel schedule-panel">
            <div className="panel-title"><div><span className="section-icon coral">□</span><div><h3>今日のスケジュール</h3><p>予定に沿って進めよう</p></div></div><button onClick={() => setActive("plan")}>すべて見る</button></div>
            <div className="task-list">{tasks.map((task, index) => <button type="button" className={`task ${checked[index] ? "is-done" : ""}`} key={task.title} onClick={()=>toggle(index)}><time>{task.time}</time><span className={`task-dot ${task.tone}`}>{checked[index] ? "✓" : ""}</span><span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><b>›</b></button>)}</div>
            <button className="add-task" onClick={() => setActive("plan")}>＋ タスクを追加する</button>
          </article>

          <article className="panel ai-panel">
            <div className="ai-title"><span className="spark">✦</span><div><small>MANABI AI</small><h3>わからないを、そのままにしない。</h3></div></div>
            {!aiOpen ? <><p>つまずいた問題を送ると、あなたの理解度に合わせてAIが解説します。</p><div className="ai-example"><span>数学</span><p>「なぜここで場合分けが必要なの？」</p></div><button className="ai-button" onClick={()=>setAiOpen(true)}>AIに質問する <span>→</span></button></> : <div className="ai-chat"><p className="bubble user">なぜここで場合分けが必要なの？</p><p className="bubble bot"><b>✦ Manabi AI</b><br/>x の符号によって式の意味が変わるからです。まず「x ≥ 0」と「x &lt; 0」の2つに分けて、同じルールが使えるか確認しましょう。</p><button onClick={()=>setAiOpen(false)}>閉じる</button></div>}
          </article>

          <article className="panel weak-panel">
            <div className="panel-title"><div><span className="section-icon blue">◇</span><div><h3>苦手を見つける</h3><p>間違いから、次の一歩へ</p></div></div><button onClick={() => setActive("mistakes")}>すべて見る</button></div>
            <div className="weak-list">{weakGroups.map(group=><button type="button" key={group.title}><span className={`folder ${group.color}`}>⌁</span><span><strong>{group.title}</strong><small>{group.subject} · {group.count}問</small></span><b>›</b></button>)}</div>
          </article>

          <article className="panel reflection-panel">
            <div className="panel-title"><div><span className="section-icon mint">↻</span><div><h3>今日の振り返り</h3><p>1分で学びを定着させよう</p></div></div></div>
            <label htmlFor="reflection">今日わかったことは？</label>
            <textarea id="reflection" value={reflection} onChange={(e)=>setReflection(e.target.value)} placeholder="例：二次関数はグラフを描いて考えると…" />
            <div className="reflection-actions"><div><span>今日の気分</span><button aria-label="良くなかった">△</button><button aria-label="普通">○</button><button aria-label="良かった">◎</button></div><button className="save" disabled={!reflection}>保存する</button></div>
          </article>
        </section>
      </section>
    </main>
  );
}

function Nav({id, icon, label, active, onClick}:{id:Tab;icon:string;label:string;active:Tab;onClick:(id:Tab)=>void}) {
  return <button type="button" className={active === id ? "active" : ""} onClick={()=>onClick(id)}><span>{icon}</span>{label}</button>;
}
