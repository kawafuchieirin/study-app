"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthUser, accessToken, beginSignIn, finishSignIn, signOut } from "./cognito-auth";

type Tab = "home" | "plan" | "review" | "notes" | "mistakes";

type StudyTask = { sk: string; title: string; subject: string; scheduled_for: string; duration_minutes: number; completed: boolean };
type Reflection = { sk: string; date: string; content: string; mood: "low" | "okay" | "good"; updated_at: string };
const apiUrl = "https://i0iik19kf1.execute-api.ap-northeast-1.amazonaws.com";

const weakGroups = [
  { title: "場合分けの見落とし", subject: "数学", count: 6, color: "coral" },
  { title: "時制の一致", subject: "英語", count: 4, color: "blue" },
  { title: "年代の前後関係", subject: "世界史", count: 3, color: "mint" },
];

export default function Home() {
  const [active, setActive] = useState<Tab>("home");
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", subject: "", scheduled_for: "", duration_minutes: "30" });
  const [aiOpen, setAiOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [mood, setMood] = useState<Reflection["mood"] | "">("");
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionMessage, setReflectionMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const completed = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const today = useMemo(() => new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date()), []);

  useEffect(() => {
    finishSignIn().then(async (user) => {
      setAuthUser(user);
      if (user) await Promise.all([loadTasks(), loadReflections()]);
    }).catch((error: Error) => setAuthError(error.message)).finally(() => setAuthLoading(false));
  }, []);

  const api = async (path: string, init?: RequestInit) => {
    const token = accessToken();
    if (!token) throw new Error("保存するにはログインしてください。");
    const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
    if (!response.ok) throw new Error(response.status === 401 ? "ログインの有効期限が切れました。再ログインしてください。" : "データを保存できませんでした。");
    return response.status === 204 ? null : response.json();
  };

  const loadTasks = async () => {
    const data = await api("/tasks");
    setTasks(data.items ?? []);
  };

  const loadReflections = async () => {
    const data = await api("/reflections");
    const items: Reflection[] = data.items ?? [];
    setReflections(items);
    const todayKey = new Date().toLocaleDateString("sv-SE");
    const current = items.find((item) => item.date === todayKey);
    if (current) { setReflection(current.content); setMood(current.mood); }
  };

  const saveReflection = async () => {
    if (!authUser) { beginSignIn(); return; }
    if (!reflection.trim() || !mood) return;
    setReflectionBusy(true); setReflectionMessage("");
    try {
      const day = new Date().toLocaleDateString("sv-SE");
      const saved = await api(`/reflections/${day}`, { method: "PUT", body: JSON.stringify({ content: reflection.trim(), mood }) });
      setReflections((current) => [saved, ...current.filter((item) => item.date !== saved.date)]);
      setReflectionMessage("今日の振り返りを保存しました");
    } catch (error) { setReflectionMessage((error as Error).message); } finally { setReflectionBusy(false); }
  };

  const selectTab = (tab: Tab) => {
    setActive(tab);
    if (tab === "review") setHistoryOpen(true);
  };

  const openTaskForm = () => {
    if (!authUser) { beginSignIn(); return; }
    const nextHour = new Date(Date.now() + 60 * 60 * 1000);
    setTaskForm({ title: "", subject: "", scheduled_for: new Date(nextHour.getTime() - nextHour.getTimezoneOffset() * 60000).toISOString().slice(0, 16), duration_minutes: "30" });
    setTaskError("");
    setTaskFormOpen(true);
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault(); setTaskBusy(true); setTaskError("");
    try {
      const created = await api("/tasks", { method: "POST", body: JSON.stringify({ ...taskForm, duration_minutes: Number(taskForm.duration_minutes), scheduled_for: new Date(taskForm.scheduled_for).toISOString() }) });
      setTasks((current) => [...current, created].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      setTaskFormOpen(false);
    } catch (error) { setTaskError((error as Error).message); } finally { setTaskBusy(false); }
  };

  const toggleTask = async (task: StudyTask) => {
    const updated = await api(`/tasks/${encodeURIComponent(task.sk)}`, { method: "PATCH", body: JSON.stringify({ completed: !task.completed }) });
    setTasks((current) => current.map((item) => item.sk === task.sk ? updated : item));
  };

  const deleteTask = async (task: StudyTask) => {
    await api(`/tasks/${encodeURIComponent(task.sk)}`, { method: "DELETE" });
    setTasks((current) => current.filter((item) => item.sk !== task.sk));
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>Manabi</span></div>
        <nav aria-label="メインナビゲーション">
          <Nav id="home" icon="⌂" label="ホーム" active={active} onClick={selectTab} />
          <Nav id="plan" icon="□" label="学習プラン" active={active} onClick={selectTab} />
          <Nav id="review" icon="↻" label="振り返り" active={active} onClick={selectTab} />
          <Nav id="notes" icon="≡" label="要点ノート" active={active} onClick={selectTab} />
          <Nav id="mistakes" icon="◇" label="苦手グループ" active={active} onClick={selectTab} />
        </nav>
        <div className="sidebar-bottom">
          <div className="streak"><span>🔥</span><div><strong>12日連続</strong><small>学習を継続中</small></div></div>
          <button className="profile" type="button" onClick={() => authUser ? signOut() : beginSignIn()}><span className="avatar">{authUser?.name.slice(0, 1) ?? "M"}</span><span><strong>{authUser?.name ?? "ゲスト"}</strong><small>{authUser?.email ?? "サインインしてください"}</small></span><b>···</b></button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p>{today}</p><h1>{authUser ? `おかえりなさい、${authUser.name}さん。` : "あなたの学びを、今日も一歩。"}</h1>{authError && <p className="auth-error">{authError}</p>}</div>
          <div className="top-actions"><button className="auth-button" disabled={authLoading} onClick={() => authUser ? signOut() : beginSignIn()}>{authLoading ? "確認中…" : authUser ? "ログアウト" : "ログイン"}</button><button className="icon-button" aria-label="通知">♢<i /></button><button className="primary" onClick={openTaskForm}>＋ 今日の予定を追加</button></div>
        </header>

        <section className="hero-grid">
          <article className="focus-card">
            <div className="eyebrow">TODAY&apos;S FOCUS</div>
            <h2>今日やることを、<br />ひとつずつ。</h2>
            <p>計画の <strong>{completed}/{tasks.length}</strong> が完了しました。いいペースです。</p>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-label"><span>{progress}% 完了</span><span>残り {tasks.length - completed} タスク</span></div>
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
            <div className="panel-title"><div><span className="section-icon coral">□</span><div><h3>学習スケジュール</h3><p>追加・完了・削除が保存されます</p></div></div></div>
            <div className="task-list">{tasks.length === 0 && <p className="empty-tasks">{authUser ? "予定はまだありません。最初の予定を追加しましょう。" : "ログインすると予定を作成できます。"}</p>}{tasks.map((task) => <div className={`task ${task.completed ? "is-done" : ""}`} key={task.sk}><button type="button" className="task-main" onClick={()=>toggleTask(task)}><time>{new Date(task.scheduled_for).toLocaleTimeString("ja-JP", {hour:"2-digit",minute:"2-digit"})}</time><span className="task-dot coral">{task.completed ? "✓" : ""}</span><span className="task-copy"><strong>{task.title}</strong><small>{task.subject} · {task.duration_minutes}分</small></span></button><button className="delete-task" aria-label={`${task.title}を削除`} onClick={()=>deleteTask(task)}>×</button></div>)}</div>
            <button className="add-task" onClick={openTaskForm}>＋ タスクを追加する</button>
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
            <div className="panel-title"><div><span className="section-icon mint">↻</span><div><h3>今日の振り返り</h3><p>1分で学びを定着させよう</p></div></div><button onClick={()=>setHistoryOpen(true)}>履歴を見る</button></div>
            <label htmlFor="reflection">今日わかったことは？</label>
            <textarea id="reflection" value={reflection} onChange={(e)=>setReflection(e.target.value)} placeholder="例：二次関数はグラフを描いて考えると…" />
            <div className="reflection-actions"><div><span>今日の気分</span><button className={mood === "low" ? "selected" : ""} aria-label="良くなかった" onClick={()=>setMood("low")}>△</button><button className={mood === "okay" ? "selected" : ""} aria-label="普通" onClick={()=>setMood("okay")}>○</button><button className={mood === "good" ? "selected" : ""} aria-label="良かった" onClick={()=>setMood("good")}>◎</button></div><button className="save" disabled={!reflection.trim() || !mood || reflectionBusy} onClick={saveReflection}>{reflectionBusy ? "保存中…" : "保存する"}</button>{reflectionMessage && <small className="save-message">{reflectionMessage}</small>}</div>
          </article>
        </section>
      </section>
      {taskFormOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTaskFormOpen(false)}><form className="task-modal" onSubmit={createTask}><div className="modal-heading"><div><small>STUDY PLAN</small><h2>学習予定を追加</h2></div><button type="button" aria-label="閉じる" onClick={()=>setTaskFormOpen(false)}>×</button></div><label>やること<input required maxLength={120} value={taskForm.title} onChange={(e)=>setTaskForm({...taskForm,title:e.target.value})} placeholder="例：英単語を50語覚える" autoFocus /></label><label>科目<input required value={taskForm.subject} onChange={(e)=>setTaskForm({...taskForm,subject:e.target.value})} placeholder="例：英語" /></label><div className="form-row"><label>開始日時<input required type="datetime-local" value={taskForm.scheduled_for} onChange={(e)=>setTaskForm({...taskForm,scheduled_for:e.target.value})} /></label><label>学習時間（分）<input required type="number" min="1" max="480" value={taskForm.duration_minutes} onChange={(e)=>setTaskForm({...taskForm,duration_minutes:e.target.value})} /></label></div>{taskError && <p className="form-error">{taskError}</p>}<div className="modal-actions"><button type="button" onClick={()=>setTaskFormOpen(false)}>キャンセル</button><button className="primary" disabled={taskBusy}>{taskBusy ? "保存中…" : "予定を保存"}</button></div></form></div>}
      {historyOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHistoryOpen(false)}><section className="task-modal history-modal"><div className="modal-heading"><div><small>REFLECTION HISTORY</small><h2>振り返り履歴</h2></div><button type="button" aria-label="閉じる" onClick={()=>setHistoryOpen(false)}>×</button></div>{!authUser ? <div className="history-empty"><p>履歴を見るにはログインしてください。</p><button className="primary" onClick={()=>beginSignIn()}>ログイン</button></div> : reflections.length === 0 ? <p className="history-empty">保存された振り返りはまだありません。</p> : <div className="history-list">{reflections.map((item)=><article key={item.sk}><div><time>{new Date(`${item.date}T00:00:00`).toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric"})}</time><span>{item.mood === "good" ? "◎" : item.mood === "okay" ? "○" : "△"}</span></div><p>{item.content}</p></article>)}</div>}</section></div>}
    </main>
  );
}

function Nav({id, icon, label, active, onClick}:{id:Tab;icon:string;label:string;active:Tab;onClick:(id:Tab)=>void}) {
  return <button type="button" className={active === id ? "active" : ""} onClick={()=>onClick(id)}><span>{icon}</span>{label}</button>;
}
