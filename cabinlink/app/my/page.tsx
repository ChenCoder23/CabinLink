"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CabinetOverview } from "@/components/cabinet-overview";

export default function MyCabinets() {
  return <main className="min-h-screen bg-[#f5f8f7] text-[#193440]"><div className="mx-auto max-w-xl px-5 pb-12 pt-7 sm:pt-12">
    <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#667f82]"><ArrowLeft className="size-4" />返回首页</Link>
    <h1 className="mt-7 text-2xl font-bold">我的智能柜</h1>
    <CabinetOverview />
  </div></main>;
}
