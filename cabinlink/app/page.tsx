"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight, Copy, LoaderCircle, LogOut, Plus, Settings2 } from "lucide-react";
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
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [name, setName] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedCabinet | null>(null);
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
      router.push(target.pathname);
    } catch (error) { toast.error(error instanceof Error ? error.message : "加入失败"); setBusy(false); }
  }

  if (checkingSession) return <main className="grid min-h-screen place-items-center bg-[#f5f8f7]"><LoaderCircle className="size-6 animate-spin text-[#6b938b]" /></main>;
  if (!user) return <AuthPanel onAuthenticated={setUser} />;

  return <main className="min-h-screen bg-[#f5f8f7] text-[#193440]"><div className="mx-auto max-w-xl px-5 pb-12 pt-7 sm:pt-12">
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-[#193440] text-white"><Archive className="size-4" /></span><span className="font-bold">柜联</span></Link>
      <div className="flex min-w-0 items-center gap-2"><span className="max-w-24 truncate text-sm text-[#7d9295] sm:max-w-40">{user.username || user.email}</span><Link href="/settings" aria-label="账号设置" className="grid size-10 place-items-center rounded-xl text-[#667f82] hover:bg-white"><Settings2 className="size-4" /></Link><button onClick={() => void logout()} aria-label="退出登录" className="grid size-10 place-items-center rounded-xl text-[#667f82] hover:bg-white"><LogOut className="size-4" /></button></div>
    </header>
    <h1 className="mt-11 text-[1.7rem] font-bold tracking-tight">我的智能柜</h1>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <button onClick={() => { setActiveForm(activeForm === "create" ? null : "create"); setCreated(null); }} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#193440] px-3 text-sm font-semibold text-white"><Plus className="size-4" />创建智能柜</button>
      <button onClick={() => { setActiveForm(activeForm === "join" ? null : "join"); setCreated(null); }} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#dfe8e5] bg-white px-3 text-sm font-semibold text-[#193440]"><ArrowRight className="size-4" />加入智能柜</button>
    </div>
    {activeForm === "create" && <form onSubmit={(event) => { event.preventDefault(); void createCabinet(name); }} className="mt-4 flex gap-2 rounded-2xl border border-[#dfe8e5] bg-white p-3"><input autoFocus aria-label="智能柜名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="智能柜名称" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button disabled={busy} className="min-h-10 rounded-xl bg-[#193440] px-4 text-sm font-semibold text-white disabled:opacity-50">创建</button></form>}
    {activeForm === "join" && <form onSubmit={joinCabinet} className="mt-4 flex gap-2 rounded-2xl border border-[#dfe8e5] bg-white p-3"><input autoFocus aria-label="智能柜链接" value={joinLink} onChange={(event) => setJoinLink(event.target.value)} placeholder="粘贴智能柜链接" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button disabled={busy} className="min-h-10 rounded-xl bg-[#193440] px-4 text-sm font-semibold text-white disabled:opacity-50">加入</button></form>}
    {created && <section className="mt-4 rounded-2xl border border-[#d3e8df] bg-[#f0faf5] p-4"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold">{created.cabinet.name}</span><a href={new URL(created.adminUrl).pathname} className="text-sm font-semibold text-[#176a56]">进入 <ArrowRight className="inline size-4" /></a></div><div className="mt-3 flex gap-2"><button onClick={() => void copyText(created.shareUrl).then(() => toast.success("分享链接已复制"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#176a56]"><Copy className="size-3.5" />复制分享链接</button><button onClick={() => void copyText(created.adminUrl).then(() => toast.success("管理链接已复制"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#176a56]"><Copy className="size-3.5" />复制管理链接</button></div></section>}
    <CabinetOverview refreshKey={refreshKey} />
  </div></main>;
}
