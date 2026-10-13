"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
type Task = {
    id: string;
    kind: string;
    title: string;
    description: string;
    due_date: string;
    criteria: string;
    progress: number;
    sort_order: number;
    focus: number;
    poster: string;
    celebration: number;
    seen: number;
};
const blank: Task = { id: '', kind: 'main', title: '', description: '', due_date: '', criteria: '', progress: 0, sort_order: 0, focus: 0, poster: '', celebration: 0, seen: 0 };
export default function Workbench() {
    const [tasks, setTasks] = useState<Task[]>([]), [introduction, setIntroduction] = useState(''), [editing, setEditing] = useState<Task | null>(null), [poster, setPoster] = useState<Task | null>(null), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
    async function load() { const r = await fetch('/api/workbench', { cache: 'no-store' }); const b = await r.json() as {
        error: string;
        tasks: Task[];
        profile: {
            introduction: string;
        };
    }; if (!r.ok) {
        setError(b.error);
        return;
    } setLoaded(true); setTasks(b.tasks); setIntroduction(b.profile.introduction); const unseen = b.tasks.find((t: Task) => t.progress === 100 && t.celebration > t.seen); if (unseen)
        setPoster(unseen); }
    useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, []);
    async function action(body: object) { const r = await fetch('/api/workbench', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const b = await r.json() as {
        error: string;
    }; if (!r.ok) {
        setError(b.error);
        return false;
    } setError(''); return true; }
    async function close() { if (poster) {
        await action({ action: 'seen', id: poster.id });
        setPoster(null);
        await load();
    } }
    useEffect(() => { if (!poster)
        return; const key = (e: KeyboardEvent) => { if (e.key === 'Escape')
        void close(); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); });
    return <main className="mx-auto max-w-5xl p-5"><a href="/">← 返回首页</a>{error && <p role="alert">{error}</p>}{loaded && <><header className="home-hero"><p>PRIVATE · EARTH ONLINE</p><h1>地球 online · 个人工作台</h1><p>考研为主线，以实际产出推进。此页面仅你本人可见。</p></header><section className="glass-panel my-5 p-5"><h2 className="text-xl font-bold">今日重点 · 最多三项</h2>{tasks.filter(t => t.focus).map(t => <p key={t.id}>{t.title} · {t.progress}%</p>)}{!tasks.some(t => t.focus) && <p>选出今天可以完成的少数关键任务。</p>}</section><button onClick={() => setEditing({ ...blank })}>新增任务或节点</button>{[['main', '主线 · 考研'], ['side', '支线 · 实习与工程能力'], ['long', '远期里程碑']].map(([kind, label]) => <section key={kind} className="my-6"><h2 className="text-xl font-bold">{label}</h2><div className="grid gap-3 sm:grid-cols-2">{tasks.filter(t => t.kind === kind).map(t => <article key={t.id} className="glass-panel p-5"><h3 className="font-bold">{t.title}</h3><p className="my-2">{t.description}</p><p className="text-sm">完成标准：{t.criteria}</p><p className="my-2">{t.due_date || '日期待设定'} · {t.progress}%</p><progress className="w-full" max="100" value={t.progress}/><div className="mt-3 flex gap-3"><button onClick={() => setEditing(t)}>编辑节点</button>{t.progress === 100 && <button onClick={() => setPoster(t)}>查看海报</button>}</div></article>)}</div></section>)}<details className="glass-panel p-5"><summary>个人介绍与规划</summary><textarea className="mt-3 w-full" rows={10} maxLength={20000} value={introduction} onChange={e => setIntroduction(e.target.value)}/><button onClick={() => void action({ action: 'profile', introduction })}>保存介绍</button></details></>}
 {editing && <div className="modal-backdrop"><form role="dialog" aria-modal="true" aria-label="编辑节点" className="glass-panel modal-panel" onSubmit={e => { e.preventDefault(); void action({ action: 'save', ...editing, focus: !!editing.focus }).then(async (ok) => { if (ok) {
        setEditing(null);
        await load();
    } }); }}><h2 className="text-xl font-bold">编辑任务或节点</h2><select aria-label="任务类型" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value })}><option value="main">主线</option><option value="side">支线</option><option value="long">远期</option></select>{[['title', '名称'], ['description', '说明'], ['criteria', '完成标准'], ['due_date', '目标日期']].map(([key, label]) => <label key={key} className="block">{label}<input required={key === 'title'} type={key === 'due_date' ? 'date' : 'text'} value={String(editing[key as keyof Task])} onChange={e => setEditing({ ...editing, [key]: e.target.value })}/></label>)}<label>进度（0–100）<input type="number" min={0} max={100} value={editing.progress} onChange={e => setEditing({ ...editing, progress: +e.target.value })}/></label><label>排序<input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })}/></label><label><input type="checkbox" checked={!!editing.focus} onChange={e => setEditing({ ...editing, focus: e.target.checked ? 1 : 0 })}/>今日重点</label><label className="block">私有海报背景（2MB）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f)
        return; if (f.size > 2097152 || !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
        setError('背景必须为2MB以内图片');
        return;
    } const reader = new FileReader(); reader.onload = () => setEditing({ ...editing, poster: String(reader.result) }); reader.readAsDataURL(f); }}/></label><button type="button" onClick={() => setEditing({ ...editing, poster: '' })}>恢复默认背景</button><p role="alert">{error}</p><div className="flex gap-3"><button>保存</button><button type="button" onClick={() => setEditing(null)}>取消</button>{editing.id && <button type="button" onClick={() => void action({ action: 'delete', id: editing.id }).then(async (ok) => { if (ok) {
        setEditing(null);
        await load();
    } })}>删除</button>}</div></form></div>}
 {poster && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="节点完成海报" className="milestone-poster" style={poster.poster ? { backgroundImage: `linear-gradient(#0006,#0009),url(${poster.poster})` } : {}}><button autoFocus className="float-right" onClick={() => void close()}>关闭 ×</button><p>MILESTONE UNLOCKED</p><h2 className="my-8 text-4xl font-bold">{poster.title}</h2><p>{poster.criteria}</p><p className="mt-10">节点达成 · 继续走好下一步</p></section></div>}</main>;
}
