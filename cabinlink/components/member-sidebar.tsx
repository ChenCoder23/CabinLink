"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
import { Home, Archive, BookOpen, Settings, ShieldCheck } from 'lucide-react';
import { SiteBrand } from '@/components/site-brand';
import { UserAvatar } from '@/components/personal-settings';
import type { AuthUser } from '@/components/auth-panel';
export function MemberSidebar({active}:{active:'home'|'wordbook'}) {
 const [user,setUser]=useState<AuthUser|null>(null);
 useEffect(()=>{void fetch('/api/auth/session').then(r=>r.json() as Promise<{user:AuthUser|null}>).then(b=>setUser(b.user)).catch(()=>{});},[]);
 return <aside className="space-sidebar"><a href="/" className="space-brand"><SiteBrand/></a><nav aria-label="用户导航"><a className={active==='home'?'is-active':''} href="/"><Home size={20}/>首页</a><a href="/my"><Archive size={20}/>我的智能柜</a><a className={active==='wordbook'?'is-active':''} href="/wordbook"><BookOpen size={20}/>单词本</a></nav><div className="space-sidebar-bottom">{user?.role==='admin'&&<a href="/admin"><ShieldCheck size={19}/>管理后台</a>}<a href="/settings"><Settings size={19}/>设置</a>{user&&<a href="/settings"><UserAvatar user={user}/><span>{user.username||user.email}</span></a>}</div></aside>;
}
