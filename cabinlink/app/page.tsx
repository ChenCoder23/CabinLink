/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids Vinext RSC link errors. */
"use client";
import { UserAvatar, QuotaNotice } from "@/components/personal-settings";
import { useBrand, SiteBrand } from "@/components/site-brand";

import { useCallback, useEffect, useState } from "react";


import { ArrowRight, Copy, LoaderCircle, LogOut, Plus, Settings2, Home as HomeIcon, Archive, BookOpen, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthPanel, type AuthUser } from "@/components/auth-panel";
import { CabinetOverview } from "@/components/cabinet-overview";
import { copyText } from "@/lib/copy-client";

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try { const url = new URL(value, window.location.origin); return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null; }
  catch { return null; }
}

type CreatedCabinet = { shareUrl: string; adminUrl: string; cabinet: { name: string } };
type ActiveForm = "create" | "join" | null;

export default function Home() {

  const brand = useBrand() as ReturnType<typeof useBrand> & {heroTitle?:string;heroDescription?:string;heroBackground?:string};
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [name, setName] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedCabinet | null>(null);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const createCabinet = useCallback(async (requestedName: string) => {
    if (!requestedName.trim()) { toast.error("请输入智能柜名称"); return null; }
    setBusy(true);
    try {
      const response = await fetch("/api/cabinets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: requestedName }) });
      const body = await response.json() as CreatedCabinet & { error?: string };
      if (response.status === 401) { setUser(null); throw new Error("请重新登录"); }
      if (!response.ok) throw new Error(body.error || "创建失败");
      setCreated(body);
      setName("");
      setActiveForm(null);
      setRefreshKey((key) => key + 1);
      toast.success("创建成功");
      return body;
    } catch (error) { toast.error(error instanceof Error ? error.message : "创建失败"); return null; }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_cabinlink_cabinet", title: "创建智能柜", description: "为当前登录账号创建文件共享智能柜，并返回分享与管理链接。",
      inputSchema: { type: "object", properties: { name: { type: "string", description: "智能柜名称" } }, required: ["name"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        const requestedName = typeof input === "object" && input !== null && "name" in input ? (input as { name?: unknown }).name : undefined;
        if (typeof requestedName !== "string" || !requestedName.trim()) throw new Error("name 必须是非空字符串");
        const result = await createCabinet(requestedName);
        if (!result) throw new Error("创建智能柜失败");
        return { shareUrl: result.shareUrl, adminUrl: result.adminUrl };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [createCabinet]);

  useEffect(() => {
    void fetch("/api/auth/session").then(async (response) => {
      if (!response.ok) throw new Error("读取登录状态失败");
      return response.json();
    }).then((body) => setUser((body as { user: AuthUser | null }).user ?? null)).catch(() => setUser(null)).finally(() => setCheckingSession(false));
  }, []);
  useEffect(() => { if (user) { const destination = safeReturnTo(); if (destination && destination !== "/") window.location.replace(destination); } }, [user]);

  async function logout() {
    const response = await fetch("/api/auth/session", { method: "DELETE" });
    if (!response.ok) return toast.error("退出失败");
    setUser(null); setCreated(null);
  }
  async function joinCabinet(event: React.FormEvent) {
    event.preventDefault();
    let target: URL;
    try {
      target = new URL(joinLink.trim(), window.location.origin);
      if (target.origin !== window.location.origin || !/^\/(c|manage)\/[A-Za-z0-9_-]{32,}$/.test(target.pathname)) throw new Error();
    } catch { toast.error("请粘贴有效的智能柜链接"); return; }
    setBusy(true);
    try {
      const token = target.pathname.split("/")[2];
      const response = await fetch(`/api/cabinets/${token}/join`, { method: "POST" });
      const body = await response.json() as { error?: string; cabinet?: { id: string } };
      if (response.status === 401) { setUser(null); throw new Error("请重新登录"); }
      if (!response.ok || !body.cabinet) throw new Error(body.error || "加入失败");
      window.location.href=target.pathname;
    } catch (error) { toast.error(error instanceof Error ? error.message : "加入失败"); setBusy(false); }
  }

  if (checkingSession) return <main className="grid min-h-screen place-items-center bg-[#e9e7e3]"><LoaderCircle className="size-6 animate-spin text-[#6b938b]" /></main>;
  if (!user) return <AuthPanel onAuthenticated={(signedIn)=>{setUser(signedIn);void fetch('/api/auth/session').then(r=>r.json() as Promise<{user:AuthUser}>).then(b=>setUser(b.user)).catch(()=>{});}} />;

  return <main className="space-dashboard"><aside className="space-sidebar"><a href="/" className="space-brand"><SiteBrand /></a><p className="space-brand-sub">你的数字收纳空间</p><nav aria-label="用户导航"><a className="is-active" href="/"><HomeIcon size={19}/>首页</a><a href="#cabinets"><Archive size={19}/>我的智能柜</a><a href="/wordbook"><BookOpen size={19}/>单词本</a></nav><div className="space-sidebar-bottom">{user.role === 'admin' && <a href="/admin"><ShieldCheck size={18}/>管理后台</a>}<a href="/settings"><Settings2 size={18}/>设置</a><a href="/settings"><UserAvatar user={user}/><span>{user.username || user.email}</span></a><button onClick={()=>void logout()}><LogOut size={18}/>退出登录</button></div></aside><div className="space-main">
    <header className="space-heading"><div><h1>我的空间</h1><p>整理生活，也积累成长。</p></div><div className="space-heading-actions"><label className="space-search"><Search size={18}/><input aria-label="搜索智能柜" placeholder="搜索智能柜…" value={query} onChange={e=>setQuery(e.target.value)}/></label><a href="/settings" aria-label="个人设置"><UserAvatar user={user}/></a></div></header>
    <section className="space-hero" style={{backgroundImage:`linear-gradient(90deg,#edf4eadd,#edf4ea00 68%),url(${brand.heroBackground || '/home-banner.png'})`}}><p className="space-quote">每天积累一点，<br/>让美好有迹可循。</p><h2>{brand.heroTitle || "把美好，收进同一个柜子。"}</h2><p>{brand.heroDescription || "整理照片、收藏文件，用一个链接连接彼此。"}</p>{user.role==='admin'&&<a className="hero-edit" href="/admin#settings">更换顶部图片</a>}</section>
    <div className="space-columns"><section id="cabinets" className="space-card cabinet-space"><header className="space-card-heading"><h2><Archive size={23}/>我的智能柜</h2><div><button className="space-primary" onClick={()=>{setActiveForm(activeForm==='create'?null:'create');setCreated(null);}}><Plus size={16}/>创建智能柜</button><button onClick={()=>{setActiveForm(activeForm==='join'?null:'join');setCreated(null);}}><ArrowRight size={16}/>加入智能柜</button></div></header>
    {activeForm === "create" && <form onSubmit={(event) => { event.preventDefault(); void createCabinet(name); }} className="mt-4 flex gap-2 rounded-2xl border border-[#d4d2cd] bg-white p-3"><input autoFocus aria-label="智能柜名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="智能柜名称" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button disabled={busy} className="min-h-10 rounded-xl bg-[#303236] px-4 text-sm font-semibold text-white disabled:opacity-50">创建</button></form>}
    {activeForm === "join" && <form onSubmit={joinCabinet} className="mt-4 flex gap-2 rounded-2xl border border-[#d4d2cd] bg-white p-3"><input autoFocus aria-label="智能柜链接" value={joinLink} onChange={(event) => setJoinLink(event.target.value)} placeholder="粘贴智能柜链接" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button disabled={busy} className="min-h-10 rounded-xl bg-[#303236] px-4 text-sm font-semibold text-white disabled:opacity-50">加入</button></form>}
    {created && <section className="mt-4 rounded-2xl border border-[#d3e8df] bg-[#f0faf5] p-4"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold">{created.cabinet.name}</span><a href={new URL(created.adminUrl).pathname} className="text-sm font-semibold text-[#176a56]">进入 <ArrowRight className="inline size-4" /></a></div><div className="mt-3 flex gap-2"><button onClick={() => void copyText(created.shareUrl).then(() => toast.success("分享链接已复制"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#176a56]"><Copy className="size-3.5" />复制分享链接</button><button onClick={() => void copyText(created.adminUrl).then(() => toast.success("管理链接已复制"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#176a56]"><Copy className="size-3.5" />复制管理链接</button></div></section>}
    <CabinetOverview refreshKey={refreshKey} dashboard query={query} onCreate={()=>setActiveForm('create')} onJoin={()=>setActiveForm('join')}/></section><aside className="space-right"><a href="/wordbook" className="space-card space-wordbook"><h2><BookOpen size={21}/>单词本 <ArrowRight size={16}/></h2><h3>每天一点，离目标更近。</h3><p>查看今日单词，记录学习标记。</p><span className="space-link-button">打开单词本 →</span></a><section className="space-card storage-card"><h2>存储空间</h2><QuotaNotice dashboard/></section><section className="space-card space-tip"><h2>留住值得珍藏的瞬间</h2><p>为照片、文件和共同回忆，留一个专属空间。</p></section></aside></div>
  </div></main>;
}
