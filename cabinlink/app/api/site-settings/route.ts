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
    const body = await request.json() as { desktopTitle?: unknown; mobileTitle?: unknown; logoUrl?: unknown };
    if (typeof body.desktopTitle !== "string" || !body.desktopTitle.trim() || body.desktopTitle.trim().length > 40 || typeof body.mobileTitle !== "string" || !body.mobileTitle.trim() || body.mobileTitle.trim().length > 20) return jsonError("电脑端标题需为 1–40 字，手机端标题需为 1–20 字。");
    if (typeof body.logoUrl !== "string" || body.logoUrl.length > 700_000 || (body.logoUrl !== "" && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.logoUrl))) return jsonError("请上传 PNG、JPEG 或 WebP 图片（最大 500 KB）。");
    const { db } = requireStorage();
    await db.prepare("INSERT INTO site_settings (id, desktop_title, mobile_title, logo_url) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET desktop_title = excluded.desktop_title, mobile_title = excluded.mobile_title, logo_url = excluded.logo_url").bind(body.desktopTitle.trim(), body.mobileTitle.trim(), body.logoUrl).run();
    return Response.json(await readBrand(), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return jsonError("保存网站设置失败。", 500); }
}
