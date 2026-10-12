"use client";
/* eslint-disable @next/next/no-img-element -- Brand images are uploaded data URLs or a local static asset. */
import { createContext, useContext, useEffect, useState } from "react";
type Brand = { desktopTitle: string; mobileTitle: string; logoUrl: string };
const initial: Brand = { desktopTitle: "柜联", mobileTitle: "柜联", logoUrl: "" };
const BrandContext = createContext(initial);
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState(initial);
  useEffect(() => {
    const load = () => { void fetch("/api/site-settings").then(async (response) => { if (response.ok) setBrand(await response.json() as Brand); }).catch(() => undefined); };
    load(); window.addEventListener("site-brand-updated", load);
    return () => window.removeEventListener("site-brand-updated", load);
  }, []);
  useEffect(() => { const media = window.matchMedia("(max-width: 639px)"); const update = () => { document.title = media.matches ? brand.mobileTitle : brand.desktopTitle; document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]').forEach((icon) => { icon.href = brand.logoUrl || "/site-logo.png"; }); }; update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, [brand]);
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
export function SiteBrand() {
  const brand = useContext(BrandContext);
  return <><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#303236] text-white"><img src={brand.logoUrl || "/site-logo.png"} alt="网站 Logo" className="size-full object-contain" /></span><span className="min-w-0 max-w-40 break-words font-bold"><span className="hidden sm:inline">{brand.desktopTitle}</span><span className="sm:hidden">{brand.mobileTitle}</span></span></>;
}
