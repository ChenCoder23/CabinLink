"use client";
import { useEffect, useState } from 'react';
type Library = {
    id: string;
    name: string;
    status: string;
    total: number;
    imported: number;
    error: string;
};
type Schedule = {
    id: string;
    library_id: string;
    status: string;
    start_date: string;
    publish_time: string;
    daily_count: number;
};
type Run = {
    id: string;
    study_date: string;
    count: number;
    created_at: string;
};
export function WordScheduleAdmin() {
    const [data, setData] = useState<{
        libraries: Library[];
        schedules: Schedule[];
        runs: Run[];
    }>({ libraries: [], schedules: [], runs: [] }), [categories, setCategories] = useState<{
        id: string;
        name: string;
    }[]>([]), [category, setCategory] = useState(''), [library, setLibrary] = useState(''), [date, setDate] = useState(''), [time, setTime] = useState(''), [count, setCount] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
    async function load() { const [r, c] = await Promise.all([fetch('/api/admin/word-schedules'), fetch('/api/admin/wordbook')]); if (r.ok)
        setData(await r.json()); if (c.ok)
        setCategories((await c.json() as {
            categories: {
                id: string;
                name: string;
            }[];
        }).categories); }
    useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, []);
    async function action(body: object) { setBusy(true); try {
        const r = await fetch('/api/admin/word-schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const b = await r.json() as {
            error: string;
            days: number;
            total: number;
            last_date: string;
            sample: {
                english: string;
            }[];
        };
        if (!r.ok)
            throw Error(b.error);
        setMessage(b.days ? `共${b.total}词，${b.days}天，最后发布日期${b.last_date}。首批：${b.sample.map((w: {
            english: string;
        }) => w.english).join('、')}` : '操作已保存');
        await load();
    }
    catch (e) {
        setMessage(String(e));
    }
    finally {
        setBusy(false);
    } }
    return <section className="glass-panel mt-6 p-5 space-y-4"><h2 className="text-xl font-bold">大词库与定时发布</h2><p>最大20MB / 50,000行。沿用英文、中文意思模板。完成导入后手动设置排程，时间均为北京时间。</p><select aria-label="导入分类" value={category} onChange={e => setCategory(e.target.value)}><option value="">请选择分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input disabled={busy || !category} aria-label="大词库Excel" type="file" accept=".xlsx" onChange={e => { const file = e.target.files?.[0]; if (!file)
        return; if (file.size > 20 * 1024 * 1024) {
        setMessage('最大20MB');
        return;
    } setBusy(true); const form = new FormData(); form.set('file', file); form.set('category', category); const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/admin/word-schedules'); xhr.upload.onprogress = e => setProgress(e.lengthComputable ? `上传${Math.round(e.loaded / e.total * 100)}%` : '上传中'); const timer = setInterval(() => void load(), 1500); xhr.onload = () => { clearInterval(timer); setBusy(false); try {
        const b = JSON.parse(xhr.responseText);
        setMessage(xhr.status === 200 ? `已导入${b.total}词` : b.error);
    }
    catch {
        setMessage('导入失败');
    } setProgress(''); void load(); }; xhr.onerror = () => { clearInterval(timer); setBusy(false); setMessage('网络中断，请查看导入记录'); }; xhr.send(form); }}/>{progress && <p role="status">{progress}</p>}{data.libraries.map(l => <div key={l.id} className="border-t py-2"><strong>{l.name}</strong> · {l.status} · {l.imported}/{l.total} {l.error && <p className="whitespace-pre-wrap text-red-600">{l.error}</p>}</div>)}<form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void action({ action: 'save', library_id: library, start_date: date, publish_time: time, daily_count: +count }); }}><label>词库<select required value={library} onChange={e => setLibrary(e.target.value)}><option value="">请选择</option>{data.libraries.filter(l => l.status === 'ready').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>开始日期<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label>北京时间<input required type="time" value={time} onChange={e => setTime(e.target.value)}/></label><label>每日数量<input required type="number" min={1} max={500} value={count} onChange={e => setCount(e.target.value)}/></label><button disabled={busy}>保存并启用排程</button><button type="button" disabled={busy || !library || !date || !time || !count} onClick={() => void action({ action: 'preview', library_id: library, start_date: date, publish_time: time, daily_count: +count })}>预览分批</button></form><p role="status" className="whitespace-pre-wrap">{message}</p>{data.schedules.map(s => <div key={s.id} className="border-t py-3">{data.libraries.find(l => l.id === s.library_id)?.name} · {s.start_date}起 · 每天{s.publish_time} · {s.daily_count}词 · {s.status}{s.status !== 'finished' && <button disabled={busy} onClick={() => void action({ action: 'status', id: s.id, status: s.status === 'active' ? 'paused' : 'active' })}>{s.status === 'active' ? '暂停' : '恢复'}</button>}</div>)}<h3 className="font-bold">最近执行记录</h3>{data.runs.map(r => <p key={r.id}>{r.study_date} · {r.count}词 · {new Date(r.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>)}<button disabled={busy} onClick={() => void action({ action: 'run' })}>立即检查到期批次</button></section>;
}
