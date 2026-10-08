"use client";

import { useState } from "react";
import { Archive, ArrowRight, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

export type AuthUser = { id: string; username: string | null; email: string | null };
type Mode = "login" | "register" | "email";

async function post(url: string, payload: object): Promise<{ user: AuthUser }> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json() as { user: AuthUser; error?: string };
  if (!response.ok) throw new Error(body.error || "操作失败，请稍后重试。");
  return body;
}

export function AuthPanel({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const body = await post(mode === "register" ? "/api/auth/register" : "/api/auth/login", { username, password });
      setPassword(""); onAuthenticated(body.user); toast.success(mode === "register" ? "账号已创建" : "登录成功");
    } catch (error) { toast.error(error instanceof Error ? error.message : "登录失败"); }
    finally { setBusy(false); }
  }
  async function sendCode() {
    setBusy(true);
    try {
      await post("/api/auth/email/send-code", { email, purpose: "login" });
      setSent(true); setCooldown(true); window.setTimeout(() => setCooldown(false), 60_000); toast.success("验证码已发送，请查收邮件");
    } catch (error) { toast.error(error instanceof Error ? error.message : "发送失败"); }
    finally { setBusy(false); }
  }
  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const body = await post("/api/auth/email/verify-code", { email, code, purpose: "login" });
      setCode(""); onAuthenticated(body.user); toast.success("登录成功");
    } catch (error) { toast.error(error instanceof Error ? error.message : "验证码无效"); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#edf4f2] px-3 py-5 text-[#123047] sm:px-4 sm:py-8">
    <div className="w-full max-w-md rounded-[1.75rem] border border-[#c7dcd8] bg-white p-5 shadow-[0_18px_45px_rgba(21,65,78,.1)] sm:p-8">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#123047] text-white"><Archive className="size-5" /></span><div><b className="text-lg">柜联</b><p className="text-sm text-[#58727b]">登录后共享照片和文件</p></div></div>
      <div className="mt-6 grid grid-cols-3 rounded-xl bg-[#edf4f2] p-1 sm:mt-7" role="tablist" aria-label="登录方式">
        {([["login", "账号登录"], ["register", "注册账号"], ["email", "邮箱登录"]] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`min-h-11 rounded-lg px-1 py-2.5 text-xs font-semibold sm:px-2 sm:text-sm ${mode === value ? "bg-white text-[#123047] shadow-sm" : "text-[#5d777d]"}`}>{label}</button>)}
      </div>
      {mode === "email" ? <form onSubmit={verifyCode} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">邮箱地址<input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} placeholder="name@example.com" className="rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label>
        <button type="button" onClick={() => void sendCode()} disabled={busy || !email || cooldown} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#b9d7cf] px-4 py-3 font-semibold text-[#155a4c] disabled:opacity-50"><Mail className="size-4" />{cooldown ? "请稍后再发送" : "发送验证码"}</button>
        {sent && <><label className="grid gap-2 text-sm font-semibold">6 位验证码<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="请输入邮件中的验证码" className="rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label><button disabled={busy || code.length !== 6} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#123047] px-4 py-3 font-semibold text-white disabled:opacity-50">验证并登录<ArrowRight className="size-4" /></button></>}
        <p className="text-sm leading-6 text-[#617b82]">首次验证邮箱会自动创建账号。登录后可设置账号和密码。</p>
      </form> : <form onSubmit={submitCredentials} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">账号<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={32} placeholder="3–32 位中文、字母或数字" className="rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label>
        <label className="grid gap-2 text-sm font-semibold">密码<input required type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} maxLength={128} placeholder="至少 6 位" className="rounded-xl border border-[#cbdad8] px-4 py-3 text-base font-normal outline-none focus:border-[#17836d]" /></label>
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#123047] px-4 py-3 font-semibold text-white disabled:opacity-50"><KeyRound className="size-4" />{busy ? "请稍候…" : mode === "register" ? "创建账号并登录" : "登录"}<ArrowRight className="size-4" /></button>
      </form>}
    </div>
  </main>;
}
