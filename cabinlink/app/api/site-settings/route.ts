import { sameOrigin } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";
import { readBrand, siteAdmin } from "@/lib/site-settings";

export async function GET(request: Request) {
  try { return Response.json({ ...await readBrand(), canManage: await siteAdmin(request) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return jsonError("读取网站设置失败。", 500); }
}
export async function PUT(request: Request) {
  try {
    if (!sameOrigin(request) || !await siteAdmin(request)) return jsonError("仅网站管理员可以修改设置。", 403);
    const body = await request.json() as { desktopTitle?: unknown; mobileTitle?: unknown; logoUrl?: unknown; heroTitle?: unknown; heroDescription?: unknown; heroBackground?: unknown };
    if (typeof body.desktopTitle !== "string" || !body.desktopTitle.trim() || body.desktopTitle.trim().length > 40 || typeof body.mobileTitle !== "string" || !body.mobileTitle.trim() || body.mobileTitle.trim().length > 20) return jsonError("电脑端标题需为 1–40 字，手机端标题需为 1–20 字。");
    if (typeof body.logoUrl !== "string" || body.logoUrl.length > 700_000 || (body.logoUrl !== "" && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.logoUrl))) return jsonError("请上传 PNG、JPEG 或 WebP 图片（最大 500 KB）。");
    const existing=await readBrand();body.heroTitle ??= existing.heroTitle;body.heroDescription ??= existing.heroDescription;body.heroBackground ??= existing.heroBackground;
    if (typeof body.heroTitle !== "string" || !body.heroTitle.trim() || body.heroTitle.length > 100 || typeof body.heroDescription !== "string" || body.heroDescription.length > 500 || typeof body.heroBackground !== "string" || body.heroBackground.length > 2_800_000 || (body.heroBackground && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.heroBackground))) return jsonError("横幅标题最多100字、说明最多500字，背景最大2MB。");
    const { db } = requireStorage();
    await db.prepare("INSERT INTO site_settings (id, desktop_title, mobile_title, logo_url, hero_title, hero_description, hero_background) VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET desktop_title = excluded.desktop_title, mobile_title = excluded.mobile_title, logo_url = excluded.logo_url, hero_title=excluded.hero_title, hero_description=excluded.hero_description, hero_background=excluded.hero_background").bind(body.desktopTitle.trim(), body.mobileTitle.trim(), body.logoUrl, body.heroTitle.trim(), body.heroDescription, body.heroBackground).run();
    return Response.json(await readBrand(), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return jsonError("保存网站设置失败。", 500); }
}
