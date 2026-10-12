import { sessionUser } from "@/lib/auth-server";
import { requireStorage } from "@/lib/cabinet-server";

export const defaultBrand = { desktopTitle: "柜联", mobileTitle: "柜联", logoUrl: "" };
export async function siteAdmin(request: Request) {
  const user = await sessionUser(request);
  return user?.role === "admin";
}
export async function readBrand() {
  const { db } = requireStorage();
  const row = await db.prepare("SELECT desktop_title, mobile_title, logo_url FROM site_settings WHERE id = 1").first<{ desktop_title: string; mobile_title: string; logo_url: string }>();
  return row ? { desktopTitle: row.desktop_title, mobileTitle: row.mobile_title, logoUrl: row.logo_url } : defaultBrand;
}
