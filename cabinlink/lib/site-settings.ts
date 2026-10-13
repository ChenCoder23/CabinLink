import { sessionUser } from "@/lib/auth-server";
import { requireStorage } from "@/lib/cabinet-server";

export const defaultBrand = { desktopTitle: "柜联", mobileTitle: "柜联", logoUrl: "", heroTitle: "把美好，收进同一个柜子。", heroDescription: "整理照片、收藏文件，用一个链接连接彼此。", heroBackground: "" };
export async function siteAdmin(request: Request) {
  const user = await sessionUser(request);
  return user?.role === "admin";
}
export async function readBrand() {
  const { db } = requireStorage();
  const row = await db.prepare("SELECT desktop_title, mobile_title, logo_url, hero_title, hero_description, hero_background FROM site_settings WHERE id = 1").first<{ desktop_title: string; mobile_title: string; logo_url: string; hero_title: string; hero_description: string; hero_background: string }>();
  return row ? { desktopTitle: row.desktop_title, mobileTitle: row.mobile_title, logoUrl: row.logo_url, heroTitle: row.hero_title, heroDescription: row.hero_description, heroBackground: row.hero_background } : defaultBrand;
}
