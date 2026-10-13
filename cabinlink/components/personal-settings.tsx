"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { AuthUser } from "@/components/auth-panel";
export function UserAvatar({ user }: {
    user: AuthUser;
}) { let hash = 0; for (const c of user.id)
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0; return user.avatar_url ? <img className="user-avatar" src={user.avatar_url} alt="用户头像"/> : <span className="user-avatar" style={{ background: `hsl(${hash % 360} 25% 42%)`, color: "white" }} aria-label="默认头像">{(user.username || user.email || "U").slice(0, 1).toUpperCase()}</span>; }
export function QuotaNotice() { const [data, setData] = useState<{
    used: number;
    reserved: number;
    limit: number | null;
} | null>(null); useEffect(() => { void fetch('/api/personal').then(r => r.ok ? r.json() as Promise<{
    used: number;
    reserved: number;
    limit: number | null;
}> : null).then(setData).catch(() => { }); }, []); return data?.limit ? <p className="glass-panel my-4 p-3 text-sm">未绑定邮箱 · 已用 {(data.used / 1048576).toFixed(1)} / 200 MiB · 剩余 {Math.max(0, (data.limit - data.used - data.reserved) / 1048576).toFixed(1)} MiB <a href="/settings" className="underline">绑定邮箱提升额度</a></p> : null; }
async function save(body: object) { const r = await fetch('/api/personal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const b = await r.json() as {
    error: string;
    relogin?: boolean;
}; if (!r.ok)
    throw Error(b.error); return b; }
export function AvatarEditor({ user }: {
    user: AuthUser;
}) {
    const [avatar, setAvatar] = useState(user.avatar_url || ''), [source, setSource] = useState(''), [zoom, setZoom] = useState(1), [ratio, setRatio] = useState(1), [x, setX] = useState(50), [y, setY] = useState(50), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    async function upload() { setBusy(true); try {
        const img = new Image();
        img.src = source;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const size = Math.min(img.width, img.height) / zoom;
        canvas.getContext('2d')!.drawImage(img, (img.width - size) * x / 100, (img.height - size) * y / 100, size, size, 0, 0, 512, 512);
        const value = canvas.toDataURL('image/webp', .9);
        await save({ avatar: value });
        setAvatar(value);
        setSource('');
        setMessage('头像已保存');
    }
    catch (e) {
        setMessage(String(e));
    }
    finally {
        setBusy(false);
    } }
    return <section className="glass-panel p-6 space-y-3"><h2 className="text-xl font-bold">个人头像</h2><UserAvatar user={{ ...user, avatar_url: avatar }}/><label className="block">选择头像（PNG/JPEG/WebP，最大2MB）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f)
        return; if (f.size > 2097152 || !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
        setMessage('请上传2MB以内的图片');
        return;
    } const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { setRatio(image.width / Math.min(image.width, image.height)); setSource(String(reader.result)); }; image.src = String(reader.result); setZoom(1); setX(50); setY(50); }; reader.readAsDataURL(f); }}/></label>{source && <><div className="avatar-crop" style={{ backgroundImage: `url(${source})`, backgroundSize: `${zoom * ratio * 100}%`, backgroundPosition: `${x}% ${y}%` }}/><label>缩放<input type="range" min="1" max="3" step=".05" value={zoom} onChange={e => setZoom(+e.target.value)}/></label><label>水平位置<input type="range" value={x} onChange={e => setX(+e.target.value)}/></label><label>垂直位置<input type="range" value={y} onChange={e => setY(+e.target.value)}/></label><button disabled={busy} onClick={() => void upload()}>保存方形头像</button></>}<button disabled={busy} onClick={() => { setBusy(true); void save({ avatar: '' }).then(() => { setAvatar(''); setMessage('已恢复默认头像'); }).catch(e => setMessage(String(e))).finally(() => setBusy(false)); }}>恢复默认头像</button><p role="status">{message}</p></section>;
}
export function PasswordEditor() { const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false); return <form className="glass-panel p-6 space-y-3" onSubmit={e => { e.preventDefault(); setBusy(true); void save({ currentPassword: current, password }).then(() => window.location.replace('/?returnTo=/settings')).catch(e => setError(e.message)).finally(() => setBusy(false)); }}><h2 className="text-xl font-bold">修改密码</h2><label className="block">当前密码（邮箱账号首次设置可留空）<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}/></label><label className="block">新密码：8–128位，含字母和数字<input required type="password" autoComplete="new-password" minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,128}" value={password} onChange={e => setPassword(e.target.value)}/></label><button disabled={busy}>保存并重新登录</button><p role="alert">{error}</p></form>; }
