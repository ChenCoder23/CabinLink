"use client";
import { useEffect, useState } from 'react';
import { Leaf, Home, BookOpen, Briefcase, Target, User, Search, Plus, Pencil, Calendar, Flag, ChartNoAxesColumnIncreasing, ShieldCheck } from 'lucide-react';
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
    const [view,setView]=useState('overview'),[query,setQuery]=useState(''),[bannerEditing,setBannerEditing]=useState(false);
    const [banner,setBanner]=useState({hero_title:'',hero_description:'',hero_background:''});
    const [tasks, setTasks] = useState<Task[]>([]), [introduction, setIntroduction] = useState(''), [editing, setEditing] = useState<Task | null>(null), [poster, setPoster] = useState<Task | null>(null), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
    async function load() { const r = await fetch('/api/workbench', { cache: 'no-store' }); const b = await r.json() as {
        error: string;
        tasks: Task[];
        profile: {
            introduction: string;
            hero_title: string; hero_description: string; hero_background: string;
        };
    }; if (!r.ok) {
        setError(b.error);
        return;
    } setLoaded(true); setTasks(b.tasks); setIntroduction(b.profile.introduction); setBanner({hero_title:b.profile.hero_title,hero_description:b.profile.hero_description,hero_background:b.profile.hero_background}); const unseen = b.tasks.find((t: Task) => t.progress === 100 && t.celebration > t.seen); if (unseen) {
        // Persist display before opening so a reload cannot repeat the celebration.
        const seen=await fetch('/api/workbench',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'seen',id:unseen.id})});
        if(seen.ok)setPoster(unseen);
    } }
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
    const matching=tasks.filter(t=>(t.title+' '+t.description).toLowerCase().includes(query.toLowerCase()));
    const main=matching.filter(t=>t.kind==='main'),side=matching.filter(t=>t.kind==='side'),long=matching.filter(t=>t.kind==='long');
    const exam=tasks.find(t=>/初试/.test(t.title));
    const examMonth=exam?.due_date?exam.due_date.slice(0,7).replace('-','年')+'月':exam?.title.match(/\d{4}年\d{1,2}月/)?.[0] || '日期待设定';
    const scores=exam?.description.match(/\d{3}/g) || [];
    const stage=tasks.find(t=>t.kind==='main' && /基础|强化|真题|模拟/.test(t.title) && t.progress<100);
    const menus=[['overview','总览',Home],['main','考研计划',BookOpen],['side','实习与工程',Briefcase],['long','长期目标',Target],['profile','个人资料',User]] as const;
    function rows(items:Task[]) { return items.map(t=><article className="work-task" key={t.id}><span className="work-task-tag">{t.kind==='main'?(t.title.includes('408')?'408':t.title.includes('数学')?'数学':t.title.includes('英语')?'英语':'考研'):t.kind==='side'?'工程':'目标'}</span><div><h3>{t.title}</h3><p>{t.description}</p><small>{t.due_date||'日期待设定'} · {t.criteria}</small></div><span className="work-progress-label">{t.progress===0?'未开始':t.progress+'%'}</span><progress max={100} value={t.progress} aria-label={t.title+'进度'}/><button aria-label={'编辑 '+t.title} onClick={()=>setEditing(t)}>设置计划 <Pencil size={14}/></button>{t.progress===100&&<button onClick={()=>setPoster(t)}>查看海报</button>}</article>); }
    return <main className="space-dashboard work-dashboard">{loaded&&<aside className="space-sidebar"><a href="/admin/workbench" className="space-brand"><Leaf size={29}/><strong>地球 online</strong></a><p className="space-brand-sub">个人工作台</p><nav aria-label="工作台导航">{menus.map(([id,label,Icon])=><button className={view===id?'is-active':''} key={id} onClick={()=>setView(id)}><Icon size={19}/>{label}</button>)}</nav><div className="space-sidebar-bottom"><p className="sidebar-motto">好好学习<br/>慢慢变好</p><a href="/admin"><ShieldCheck size={18}/>返回管理后台</a><span className="private-label">仅本人可见 · 私人空间</span></div></aside>}<div className="space-main">{error&&<p role="alert">{error}</p>}{!loaded&&!error&&<p>正在读取私人工作台…</p>}{loaded&&<><header className="space-heading"><div><h1>个人工作台</h1><p>考研为主线，以实际产出推进。</p></div><div className="space-heading-actions"><label className="space-search"><Search size={17}/><input aria-label="搜索任务" placeholder="搜索任务、计划或内容…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="space-primary" onClick={()=>setEditing({...blank})}><Plus size={16}/>新建任务</button></div></header>
    <section className="space-hero work-hero" style={{backgroundImage:`linear-gradient(90deg,#edf4eadd,#edf4ea00 68%),url(${banner.hero_background || '/workbench-banner.png'})`}}><h2>{banner.hero_title}</h2><p>{banner.hero_description}</p><p>开始今天的一小步。</p><button className="hero-edit" onClick={()=>setBannerEditing(true)}>更换顶部图片 / 编辑文字</button></section>
    <section className="work-summary space-card"><div><Calendar/><span>目标考试<strong>{examMonth}</strong><small>{exam?.title||'在考研计划中设置初试节点'}</small></span></div><div><ChartNoAxesColumnIncreasing/><span>目标分数<strong>{scores.length? (scores[1]||scores[0])+'+':'待设定'}</strong><small>{scores.length>=3?`${scores[0]} 基础 / ${scores[2]} 冲刺`:exam?.criteria||'编辑初试节点的完成标准'}</small></span></div><div><Flag/><span>当前阶段<strong>{stage?.title||'计划待设定'}</strong><small>{stage?.criteria||'按阶段推进'}</small></span></div></section>
    {view==='profile'?<section className="space-card work-profile"><h2>个人介绍与规划</h2><p>此资料仅本人可读写。</p><textarea aria-label="个人介绍" rows={14} maxLength={20000} value={introduction} onChange={e=>setIntroduction(e.target.value)}/><button className="space-primary" onClick={()=>void action({action:'profile',introduction})}>保存介绍</button></section>:<div className="space-columns work-columns"><div className="work-left">{view==='overview'&&<section className="space-card"><header className="space-card-heading"><h2>今日重点 <small>最多三项，聚焦最重要的任务。</small></h2><small>{new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'})}</small></header><div className="focus-list">{matching.filter(t=>t.focus).map(t=><div className="focus-row" key={t.id}><input type="checkbox" aria-label={'完成 '+t.title} checked={t.progress===100} onChange={e=>void action({...t,action:'save',focus:true,progress:e.target.checked?100:0}).then(ok=>{if(ok)void load();})}/><div><strong>{t.title}</strong><p>{t.description}</p></div><span className="work-task-tag">{t.kind==='main'?'考研':'任务'}</span><button aria-label={'编辑今日任务 '+t.title} onClick={()=>setEditing(t)}><Pencil size={16}/></button></div>)}{!tasks.some(t=>t.focus)&&<p className="work-empty-focus">选出今天可以完成的少数关键任务。</p>}<button className="focus-add" onClick={()=>setEditing({...blank,focus:1})}><Plus size={16}/>添加今日任务</button></div></section>}
    {(view==='overview'||view==='main')&&<section className="space-card"><header className="space-card-heading"><h2>考研主线 <small>按阶段系统推进各科复习。</small></h2><BookOpen size={19}/></header>{rows(main)}<div className="work-timeline">{main.filter(t=>/基础|强化|真题|模拟|初试/.test(t.title)).map(t=><button key={t.id} onClick={()=>setEditing(t)} className={t.progress===100?'complete':''}><i/><strong>{t.title}</strong><small>{t.due_date||'设置日期'}</small></button>)}</div></section>}
    {view==='side'&&<section className="space-card"><header className="space-card-heading"><h2>实习与工程</h2><Briefcase size={19}/></header>{rows(side)}</section>}{view==='long'&&<section className="space-card"><header className="space-card-heading"><h2>长期目标</h2><Target size={19}/></header>{rows(long)}</section>}
    </div>{view==='overview'&&<aside className="space-right"><section className="space-card"><header className="space-card-heading"><h2><Calendar size={20}/>近期节点</h2></header>{[exam,stage].filter((t):t is Task=>!!t).map(t=><button className="work-mini-row" key={t.id} onClick={()=>setEditing(t)}><strong>{t.due_date? t.due_date+' · ':''}{t.title}</strong><small>{t.criteria}</small><span>设置日期 / 计划 →</span></button>)}</section><section className="space-card"><header className="space-card-heading"><h2><Briefcase size={20}/>实习与工程</h2></header>{side.map(t=><button className="work-mini-row" key={t.id} onClick={()=>setEditing(t)}><strong>{t.title} →</strong><small>{t.criteria}</small></button>)}</section><section className="space-card"><header className="space-card-heading"><h2><Target size={20}/>长期目标</h2></header>{long.map(t=><button className="work-mini-row" key={t.id} onClick={()=>setEditing(t)}><strong>{t.title} →</strong><small>{t.criteria}</small></button>)}</section></aside>}</div>}</>}</div>
    {bannerEditing&&<div className="modal-backdrop"><form role="dialog" aria-modal="true" aria-label="工作台顶部图片设置" className="glass-panel modal-panel" onSubmit={e=>{e.preventDefault();void action({action:'banner',...banner}).then(ok=>{if(ok){setBannerEditing(false);void load();}});}}><h2>工作台顶部图片与文字</h2><label>标题<input required maxLength={100} value={banner.hero_title} onChange={e=>setBanner({...banner,hero_title:e.target.value})}/></label><label>说明<textarea maxLength={500} value={banner.hero_description} onChange={e=>setBanner({...banner,hero_description:e.target.value})}/></label><label>顶部图片（PNG / JPEG / WebP，最大 2MB）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2097152||!['image/png','image/jpeg','image/webp'].includes(f.type)){setError('请上传2MB以内的图片');return;}const reader=new FileReader();reader.onload=()=>setBanner({...banner,hero_background:String(reader.result)});reader.readAsDataURL(f);}}/></label><div className="space-hero work-hero" style={{backgroundImage:`linear-gradient(90deg,#edf4eadd,#edf4ea00 68%),url(${banner.hero_background || '/workbench-banner.png'})`}}><h2>{banner.hero_title}</h2><p>{banner.hero_description}</p></div><button type="button" onClick={()=>setBanner({...banner,hero_background:''})}>恢复默认图片</button><p role="alert">{error}</p><div><button>保存顶部设置</button><button type="button" onClick={()=>{setBannerEditing(false);void load();}}>取消</button></div></form></div>}

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
