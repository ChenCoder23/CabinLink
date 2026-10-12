"use client";

import { useEffect, useState } from "react";
import { Archive, ArrowRight, LoaderCircle } from "lucide-react";

type Cabinet = { id: string; name: string; theme_count: number; cover_file_id: string | null };
type CabinetLists = { created: Cabinet[]; joined: Cabinet[] };

function CabinetCover({ fileId }: { fileId: string | null }) {
  const [failedFileId, setFailedFileId] = useState<string | null>(null);
  return <span className="cabinet-cover relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e9e7e3] text-[#737873]">
    <Archive className="size-6" aria-hidden="true" />
    {fileId && failedFileId !== fileId && <img src={`/api/files/${encodeURIComponent(fileId)}?inline=1`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={() => setFailedFileId(fileId)} />}
  </span>;
}

function CabinetSection({ title, cabinets }: { title: string; cabinets: Cabinet[] }) {
  return <section className="cabinet-collection mt-8">
    <h2 className="text-base font-bold text-[#303236]">{title}</h2>
    <div className="cabinet-collection-grid mt-3 overflow-hidden rounded-2xl border border-[#d4d2cd] bg-white">
      {cabinets.length ? cabinets.map((cabinet, index) => <a key={cabinet.id} href={`/my/cabinets/${encodeURIComponent(cabinet.id)}`} className={`cabinet-tile flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition hover:bg-[#f7faf9] ${index ? "border-t border-[#edf1f0]" : ""}`}>
        <CabinetCover fileId={cabinet.cover_file_id} />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[#303236]">{cabinet.name}</span><span className="mt-0.5 block text-xs text-[#666965]">{cabinet.theme_count} 个主题</span></span>
        <ArrowRight className="size-4 shrink-0 text-[#737873]" />
      </a>) : <p className="px-4 py-5 text-sm text-[#666965]">暂无智能柜</p>}
    </div>
  </section>;
}

export function CabinetOverview({ refreshKey = 0 }: { refreshKey?: number }) {
  const [lists, setLists] = useState<CabinetLists | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/cabinets", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { window.location.replace("/"); return null; }
      const body = await response.json() as CabinetLists & { error?: string };
      if (!response.ok) throw new Error(body.error || "读取失败");
      return body;
    }).then((body) => { if (active && body) { setLists(body); setError(""); } }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "读取失败"); });
    return () => { active = false; };
  }, [refreshKey]);
  if (error) return <p className="mt-8 text-sm text-[#a44444]">{error}</p>;
  if (!lists) return <div className="mt-10 flex justify-center"><LoaderCircle className="size-5 animate-spin text-[#6b938b]" /></div>;
  return <><CabinetSection title="我创建的" cabinets={lists.created} /><CabinetSection title="我加入的" cabinets={lists.joined} /></>;
}
