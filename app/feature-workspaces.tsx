"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { accessToken, beginSignIn } from "./cognito-auth";

const apiUrl = "https://i0iik19kf1.execute-api.ap-northeast-1.amazonaws.com";
type Mode = "notes" | "mistakes" | "ai";
type Note = { sk: string; title: string; subject: string; content: string; tags: string[]; updated_at: string };
type Mistake = { sk: string; subject: string; topic: string; question: string; cause: string; mastered: boolean };
type AiEntry = { sk: string; subject: string; question: string; answer: string; created_at: string };

export function FeatureWorkspace({ mode, signedIn, onClose }: { mode: Mode; signedIn: boolean; onClose: () => void }) {
  const [items, setItems] = useState<(Note | Mistake | AiEntry)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [note, setNote] = useState({ title: "", subject: "", content: "", tags: "" });
  const [mistake, setMistake] = useState({ subject: "", topic: "", question: "", cause: "" });
  const [question, setQuestion] = useState({ subject: "", question: "" });

  const request = async (path: string, init?: RequestInit) => {
    const token = accessToken();
    if (!token) throw new Error("ログインしてください。");
    const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail ?? (response.status === 401 ? "再ログインしてください。" : "処理に失敗しました。"));
    }
    return response.status === 204 ? null : response.json();
  };

  const endpoint = mode === "notes" ? "/notes" : mode === "mistakes" ? "/mistakes" : "/ai/history";
  const load = async () => {
    if (!signedIn) return;
    try { const data = await request(endpoint); setItems(data.items ?? []); }
    catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { load(); }, [mode, signedIn]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [items, search]);

  const saveNote = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = JSON.stringify({ title: note.title, subject: note.subject, content: note.content, tags: note.tags.split(/[,、]/).map((tag) => tag.trim()).filter(Boolean) });
      const saved = await request(editing ? `/notes/${encodeURIComponent(editing.sk)}` : "/notes", { method: editing ? "PUT" : "POST", body });
      setItems((current) => editing ? current.map((item) => item.sk === saved.sk ? saved : item) : [saved, ...current]);
      setEditing(null); setNote({ title: "", subject: "", content: "", tags: "" });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const editNote = (item: Note) => { setEditing(item); setNote({ title: item.title, subject: item.subject, content: item.content, tags: item.tags.join("、") }); };
  const removeNote = async (item: Note) => { await request(`/notes/${encodeURIComponent(item.sk)}`, { method: "DELETE" }); setItems((current) => current.filter((entry) => entry.sk !== item.sk)); };

  const saveMistake = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const saved = await request("/mistakes", { method: "POST", body: JSON.stringify(mistake) }); setItems((current) => [saved, ...current]); setMistake({ subject: "", topic: "", question: "", cause: "" }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const toggleMistake = async (item: Mistake) => { const saved = await request(`/mistakes/${encodeURIComponent(item.sk)}`, { method: "PATCH", body: JSON.stringify({ mastered: !item.mastered }) }); setItems((current) => current.map((entry) => entry.sk === saved.sk ? saved : entry)); };
  const removeMistake = async (item: Mistake) => { await request(`/mistakes/${encodeURIComponent(item.sk)}`, { method: "DELETE" }); setItems((current) => current.filter((entry) => entry.sk !== item.sk)); };

  const askAi = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const saved = await request("/ai/explain", { method: "POST", body: JSON.stringify(question) }); setItems((current) => [saved, ...current]); setQuestion({ subject: question.subject, question: "" }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const titles = { notes: ["要点ノート", "自分の言葉で、学びを残す"], mistakes: ["苦手グループ", "できなかった問題を科目・単元で整理"], ai: ["Manabi AI", "わからない問題を段階的に解説"] } as const;
  const grouped = mode === "mistakes" ? Object.entries((filtered as Mistake[]).reduce<Record<string, Mistake[]>>((groups, item) => { const key = `${item.subject}｜${item.topic}`; (groups[key] ??= []).push(item); return groups; }, {})) : [];

  return <div className="workspace-backdrop"><section className="feature-workspace">
    <header className="workspace-header"><div><small>MANABI WORKSPACE</small><h2>{titles[mode][0]}</h2><p>{titles[mode][1]}</p></div><button aria-label="閉じる" onClick={onClose}>×</button></header>
    {!signedIn ? <div className="workspace-signin"><p>この機能を利用するにはログインしてください。データは利用者ごとに安全に保存されます。</p><button onClick={()=>beginSignIn()}>ログインして続ける</button></div> : <>
      {mode === "notes" && <form className="feature-form" onSubmit={saveNote}><div className="form-row"><label>タイトル<input required value={note.title} onChange={(e)=>setNote({...note,title:e.target.value})} /></label><label>科目<input required value={note.subject} onChange={(e)=>setNote({...note,subject:e.target.value})} /></label></div><label>要点<textarea required value={note.content} onChange={(e)=>setNote({...note,content:e.target.value})} placeholder="重要な考え方を、自分の言葉でまとめましょう" /></label><label>タグ<input value={note.tags} onChange={(e)=>setNote({...note,tags:e.target.value})} placeholder="公式、テスト対策（読点区切り）" /></label><div className="feature-actions">{editing && <button type="button" onClick={()=>{setEditing(null);setNote({title:"",subject:"",content:"",tags:""})}}>編集をやめる</button>}<button disabled={busy}>{busy ? "保存中…" : editing ? "更新する" : "ノートを保存"}</button></div></form>}
      {mode === "mistakes" && <form className="feature-form" onSubmit={saveMistake}><div className="form-row"><label>科目<input required value={mistake.subject} onChange={(e)=>setMistake({...mistake,subject:e.target.value})} placeholder="数学" /></label><label>単元・つまずき<input required value={mistake.topic} onChange={(e)=>setMistake({...mistake,topic:e.target.value})} placeholder="場合分け" /></label></div><label>できなかった問題<textarea required value={mistake.question} onChange={(e)=>setMistake({...mistake,question:e.target.value})} /></label><label>原因・気づき<input value={mistake.cause} onChange={(e)=>setMistake({...mistake,cause:e.target.value})} placeholder="条件を読み落とした" /></label><div className="feature-actions"><button disabled={busy}>{busy ? "登録中…" : "苦手問題に追加"}</button></div></form>}
      {mode === "ai" && <form className="feature-form ai-question-form" onSubmit={askAi}><label>科目<input required value={question.subject} onChange={(e)=>setQuestion({...question,subject:e.target.value})} placeholder="数学" /></label><label>わからない問題・質問<textarea required minLength={3} value={question.question} onChange={(e)=>setQuestion({...question,question:e.target.value})} placeholder="問題文や、どこでわからなくなったかを入力してください" /></label><div className="feature-actions"><button disabled={busy}>{busy ? "解説を作成中…" : "AIに解説してもらう"}</button></div></form>}
      {error && <p className="workspace-error">{error}</p>}
      <div className="workspace-tools"><h3>{mode === "ai" ? "質問履歴" : mode === "notes" ? "保存したノート" : "自動グルーピング"}</h3><input aria-label="検索" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="検索…" /></div>
      {mode === "notes" && <div className="note-grid">{filtered.map((raw)=><article key={raw.sk} className="note-card">{(()=>{const item=raw as Note;return <><small>{item.subject}</small><h3>{item.title}</h3><p>{item.content}</p><div className="tag-row">{item.tags.map(tag=><span key={tag}>{tag}</span>)}</div><footer><button onClick={()=>editNote(item)}>編集</button><button onClick={()=>removeNote(item)}>削除</button></footer></>})()}</article>)}</div>}
      {mode === "mistakes" && <div className="mistake-groups">{grouped.map(([group, entries])=><section key={group}><h3>{group}<span>{entries.filter(item=>!item.mastered).length}問を復習</span></h3>{entries.map(item=><article className={item.mastered?"mastered":""} key={item.sk}><div><p>{item.question}</p>{item.cause&&<small>原因：{item.cause}</small>}</div><button onClick={()=>toggleMistake(item)}>{item.mastered?"未習得に戻す":"理解できた"}</button><button aria-label="削除" onClick={()=>removeMistake(item)}>×</button></article>)}</section>)}</div>}
      {mode === "ai" && <div className="ai-history">{filtered.map((raw)=>{const item=raw as AiEntry;return <article key={item.sk}><div className="ai-history-question"><small>{item.subject}</small><p>{item.question}</p></div><div className="ai-history-answer"><b>✦ Manabi AI</b><p>{item.answer}</p></div></article>})}</div>}
      {filtered.length === 0 && <p className="workspace-empty">まだデータがありません。上のフォームから最初の1件を作成しましょう。</p>}
    </>}
  </section></div>;
}
