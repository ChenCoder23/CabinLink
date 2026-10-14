"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { Database, UploadCloud, Download, Clock, FileText } from 'lucide-react';
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
export function WordScheduleAdmin({categories,categoryPanel,uploadPanel,manualPanel}:{categories:{id:string;name:string}[];categoryPanel:ReactNode;uploadPanel:ReactNode;manualPanel:ReactNode}) {
    const [file,setFile]=useState<File|null>(null),[previewed,setPreviewed]=useState(false);
    const [data, setData] = useState<{
        libraries: Library[];
        schedules: Schedule[];
        runs: Run[];
    }>({ libraries: [], schedules: [], runs: [] }), [category, setCategory] = useState(''), [library, setLibrary] = useState(''), [date, setDate] = useState(''), [time, setTime] = useState(''), [count, setCount] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
    async function load() { const r=await fetch('/api/admin/word-schedules'); if(r.ok)setData(await r.json()); }
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
    function chooseFile(next:File|undefined){if(!next)return;if(next.size>20*1024*1024||!next.name.toLowerCase().endsWith('.xlsx')){setMessage('请选择20MB以内的 .xlsx 文件');return;}setFile(next);setMessage('');}
    function upload(){if(!file||!category||busy)return;setBusy(true);setMessage('');const form=new FormData();form.set('file',file);form.set('category',category);const xhr=new XMLHttpRequest();xhr.open('POST','/api/admin/word-schedules');xhr.upload.onprogress=e=>setProgress(e.lengthComputable?`上传 ${Math.round(e.loaded/e.total*100)}%`:'上传中');const timer=setInterval(()=>void load(),1500);xhr.onload=()=>{clearInterval(timer);setBusy(false);try{const b=JSON.parse(xhr.responseText);setMessage(xhr.status===200?`已导入 ${b.total} 词`:b.error);if(xhr.status===200)setLibrary(b.id);}catch{setMessage('导入失败');}setProgress('');void load();};xhr.onerror=()=>{clearInterval(timer);setBusy(false);setProgress('');setMessage('网络中断，请查看导入记录');};xhr.send(form);}
    const valid=!!library&&!!date&&!!time&&+count>=1&&+count<=500;
    return <div className="word-admin-columns"><div className="word-admin-left"><section className="space-card schedule-panel"><header className="reference-card-heading"><h2><Database size={23}/>大词库与定时发布</h2><p>完成导入后手动设置排程，时间均为北京时间。</p></header><div className="schedule-steps">{['导入词库','设置排程','预览分批'].map((label,i)=><div key={label} className={(previewed?2:library?1:0)===i?'active':''}><b>{i+1}</b><span><strong>{label}</strong><small>{['上传 Excel 文件','设定发布时间与数量','检查并确认发布内容'][i]}</small></span></div>)}</div>
    <section className="schedule-stage import-stage"><header><b>1</b><div><h3>导入词库</h3><p>支持 Excel 格式的单词库文件，按模板列名导入。</p></div></header><div className="schedule-import-fields"><div><label>分类<select aria-label="导入分类" value={category} onChange={e=>setCategory(e.target.value)}><option value="">请选择分类</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><a download="wordbook-template.xlsx" href="/api/admin/wordbook?template=1"><Download size={18}/>下载 Excel 模板</a></div><label className="excel-dropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)chooseFile(e.dataTransfer.files[0]);}}><UploadCloud size={29}/><strong>{file?file.name:'选择或拖拽 Excel 文件'}</strong><small>最大 20 MB · 50,000 行 · 列名：英文、中文意思</small><input aria-label="大词库Excel" disabled={busy} type="file" accept=".xlsx" onChange={e=>chooseFile(e.target.files?.[0])}/></label></div><div className="import-stage-actions"><span role="status">{progress}</span><button className="reference-primary" disabled={busy||!category||!file} onClick={upload}>{busy?'正在导入…':'导入词库'}</button></div>{data.libraries.length>0&&<div className="library-history">{data.libraries.map(l=><div key={l.id}><strong>{l.name}</strong><span>{{importing:'导入中',ready:'已就绪',failed:'导入失败'}[l.status]} · {l.imported}/{l.total}</span>{l.error&&<p>{l.error}</p>}</div>)}</div>}</section>
    <section className="schedule-stage"><header><b>2</b><div><h3>设置排程</h3><p>为导入的词库设置定时发布计划。</p></div></header><form className="schedule-form" onSubmit={e=>{e.preventDefault();void action({action:'save',library_id:library,start_date:date,publish_time:time,daily_count:+count});}}><label>词库<select required value={library} onChange={e=>{setLibrary(e.target.value);setPreviewed(false);}}><option value="">请选择词库</option>{data.libraries.filter(l=>l.status==='ready').map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>开始日期<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>北京时间<input required type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>每日数量<input required type="number" min={1} max={500} placeholder="请输入数量" value={count} onChange={e=>setCount(e.target.value)}/></label><button className="reference-primary" disabled={busy||!valid}>保存并启用排程</button><button className="reference-secondary" type="button" disabled={busy||!valid} onClick={()=>{setPreviewed(true);void action({action:'preview',library_id:library,start_date:date,publish_time:time,daily_count:+count});}}>预览分批</button></form>{data.schedules.length>0&&<div className="schedule-history">{data.schedules.map(s=><div key={s.id}><span>{data.libraries.find(l=>l.id===s.library_id)?.name} · {s.start_date}起 · 每天{s.publish_time} · {s.daily_count}词 · {{active:'运行中',paused:'已暂停',finished:'已完成'}[s.status]}</span>{s.status!=='finished'&&<button disabled={busy} onClick={()=>void action({action:'status',id:s.id,status:s.status==='active'?'paused':'active'})}>{s.status==='active'?'暂停':'恢复'}</button>}</div>)}</div>}</section>{message&&<p role="status" className="schedule-message">{message}</p>}</section>{manualPanel}</div>
    <aside className="word-admin-right">{categoryPanel}<section className="space-card execution-panel"><h2><Clock size={22}/>最近执行记录</h2><div className="records-scroll">{data.runs.map(r=><p key={r.id}>{r.study_date} · {r.count}词<br/><small>{new Date(r.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</small></p>)}{!data.runs.length&&<div className="reference-record-empty"><FileText size={37}/><strong>暂无执行记录</strong></div>}</div><button disabled={busy} className="reference-soft" onClick={()=>void action({action:'run'})}>立即检查到期批次</button></section>{uploadPanel}</aside></div>;
}
