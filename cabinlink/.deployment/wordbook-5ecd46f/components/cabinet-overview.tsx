"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

type Cabinet = { id: string; name: string; theme_count: number };
type CabinetLists = { created: Cabinet[]; joined: Cabinet[] };

function CabinetSection({ title, cabinets }: { title: string; cabinets: Cabinet[] }) {
  return <section className="mt-8">
    <h2 className="text-base font-bold text-[#193440]">{title}</h2>
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#e2eae8] bg-white">
      {cabinets.length ? cabinets.map((cabinet, index) => <a key={cabinet.id} href={`/my/cabinets/${encodeURIComponent(cabinet.id)}`} className={`flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition hover:bg-[#f7faf9] ${index ? "border-t border-[#edf1f0]" : ""}`}>
        <span className="min-w-0"><span className="block truncate font-semibold text-[#193440]">{cabinet.name}</span><span className="mt-0.5 block text-xs text-[#87979b]">{cabinet.theme_count} 个主题</span></span>
        <ArrowRight className="size-4 shrink-0 text-[#8aa09f]" />
      </a>) : <p className="px-4 py-5 text-sm text-[#8a9a9d]">暂无智能柜</p>}
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
