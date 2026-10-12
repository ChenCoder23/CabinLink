"use client";
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/copy-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CabinetLinksButton({ cabinetId, token = "" }: { cabinetId: string; token?: string }) {
  const [links, setLinks] = useState<{ shareUrl: string; adminUrl: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load() {
    setOpen(true); setBusy(true); setLinks(null);
    try {
      const response = await fetch(`/api/cabinets/owned/${encodeURIComponent(cabinetId)}/links`, { method: "POST", headers: token ? { "x-cabinet-token": token } : {} });
      const body = await response.json() as { shareUrl: string; adminUrl: string; error?: string };
      if (!response.ok) throw new Error(body.error || "获取链接失败");
      setLinks(body);
    } catch (error) { toast.error(error instanceof Error ? error.message : "获取链接失败"); }
    finally { setBusy(false); }
  }
  async function copy(value: string) { try { await copyText(value); toast.success("链接已复制"); } catch { toast.error("复制失败，请手动复制链接"); } }
  return <><button onClick={() => void load()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#c9d9d8] bg-white px-3 py-2 text-sm font-semibold text-[#28515b]"><Copy className="size-4" />获取链接</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="min-w-0"><DialogHeader><DialogTitle>智能柜链接</DialogTitle><DialogDescription>分享链接用于邀请成员；管理链接拥有管理权限，请妥善保管。</DialogDescription></DialogHeader>{busy ? <p role="status">正在获取链接…</p> : links ? <div className="min-w-0 space-y-4">{([{ key: "shareUrl", label: "分享链接" }, { key: "adminUrl", label: "管理链接" }] as const).map(({ key, label }) => <div key={key}><label htmlFor={`${cabinetId}-${key}`} className="text-sm font-semibold">{label}</label><input id={`${cabinetId}-${key}`} readOnly value={links[key]} onFocus={(event) => event.target.select()} className="mt-2 w-full min-w-0 rounded-xl border border-[#c9d9d8] px-3 py-2 text-sm" /><button onClick={() => void copy(links[key])} className="mt-2 min-h-10 rounded-xl bg-[#123047] px-3 py-2 text-sm font-semibold text-white">复制{label}</button></div>)}</div> : <button onClick={() => void load()} className="min-h-10 rounded-xl bg-[#123047] px-3 py-2 text-white">重新获取</button>}</DialogContent></Dialog></>;
}
