"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import type { AuthUser } from "@/components/auth-panel";

async function post(url: string, payload: object) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json() as { user: AuthUser; error?: string };
  if (response.status === 401) { window.location.replace("/?returnTo=%2Fsettings"); throw new Error("请先登录"); }
  if (!response.ok) throw new Error(body.error || "操作失败");
  return body;
}

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/auth/session").then((response) => response.json()).then((value) => {
      const body = value as { user: AuthUser | null };
      if (!body.user) window.location.replace("/?returnTo=%2Fsettings");
      else setUser(body.user);
    }).catch(() => window.location.replace("/?returnTo=%2Fsettings")).finally(() => setLoading(false));
  }, []);
  async function sendCode() {
    setBusy(true);
    try { await post("/api/auth/email/send-code", { email, purpose: "bind" }); setSent(true); toast.success("验证码已发送"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "发送失败"); }
    finally { setBusy(false); }
  }
  async function bindEmail(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const body = await post("/api/auth/email/verify-code", { email, code, purpose: "bind" }); setUser(body.user); setCode(""); setSent(false); toast.success("邮箱已绑定"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "绑定失败"); }
    finally { setBusy(false); }
  }
  async function setCredentials(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const body = await post("/api/auth/credentials", { username, password }); setUser(body.user); setPassword(""); toast.success("账号密码已设置"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "设置失败"); }
    finally { setBusy(false); }
  }
  if (loading || !user) return <main className="grid min-h-screen place-items-center bg-[#edf4f2]"><LoaderCircle className="size-7 animate-spin text-[#17836d]" /></main>;
  return <main className="min-h-screen bg-[#edf4f2] px-4 py-6 text-[#123047] sm:py-8"><div className="mx-auto max-w-2xl"><Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#155a4c]"><ArrowLeft className="size-4" />返回首页</Link><h1 className="mt-5 text-3xl font-extrabold sm:mt-7">账号设置</h1><p className="mt-2 text-sm leading-6 text-[#5f7980] sm:text-base">绑定邮箱后，账号密码和邮箱验证码都能进入同一个账号。</p>
    <div className="mt-7 grid gap-5">
      <section className="rounded-3xl border border-[#cbded9] bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Mail className="size-5 text-[#17836d]" /><h2 className="text-xl font-bold">邮箱</h2></div>{user.email ? <p className="mt-4 break-all text-base">{user.email} <span className="ml-2 text-sm text-[#17836d]">已绑定</span></p> : <form onSubmit={bindEmail} className="mt-5 grid gap-3"><label className="grid gap-2 text-sm font-semibold">邮箱地址<input required type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} className="min-w-0 rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label><button type="button" onClick={() => void sendCode()} disabled={busy || !email} className="min-h-11 rounded-xl border border-[#b9d7cf] px-4 py-3 font-semibold text-[#155a4c] disabled:opacity-50">发送验证码</button>{sent && <><label className="grid gap-2 text-sm font-semibold">验证码<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="min-w-0 rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label><button disabled={busy || code.length !== 6} className="min-h-11 rounded-xl bg-[#123047] px-4 py-3 font-semibold text-white disabled:opacity-50">验证并绑定</button></>}</form>}</section>
      <section className="rounded-3xl border border-[#cbded9] bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><KeyRound className="size-5 text-[#17836d]" /><h2 className="text-xl font-bold">账号密码</h2></div>{user.username ? <p className="mt-4 break-all text-base">账号：{user.username}</p> : <form onSubmit={setCredentials} className="mt-5 grid gap-3"><p className="text-sm text-[#5f7980]">设置后也可以使用账号密码登录。</p><label className="grid gap-2 text-sm font-semibold">账号<input required value={username} onChange={(event) => setUsername(event.target.value)} maxLength={32} className="rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label><label className="grid gap-2 text-sm font-semibold">密码<input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label><button disabled={busy} className="min-h-11 rounded-xl bg-[#123047] px-4 py-3 font-semibold text-white disabled:opacity-50">保存账号密码</button></form>}</section>
    </div>
  </div></main>;
}
