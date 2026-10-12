import { siteAdmin } from "@/lib/site-settings";
import { authorizeCabinet, publicOrigin, sameOrigin, sessionUser } from "@/lib/auth-server";
import { hashToken, jsonError, newToken, requireStorage, shareTokenFromAdmin, tokenFrom, resolveCabinet } from "@/lib/cabinet-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
    if (!await sessionUser(request)) return jsonError("请先登录。", 401);
    const { id } = await params;
    const cabinet = await authorizeCabinet(request, id, "admin") || (await siteAdmin(request) ? await requireStorage().db.prepare("SELECT id FROM cabinets WHERE id = ? AND closed_at IS NULL").bind(id).first<{ id: string }>() : null);
    if (!cabinet) return jsonError("仅管理员可以获取链接。", 403);
    const { db } = requireStorage();
    // Keep the original hashes valid for cabinets created before link recovery existed.
    const supplied = tokenFrom(request);
    const fromLink = await resolveCabinet(supplied, "admin");
    const adminToken = fromLink?.id === id ? supplied : newToken();
    const shareToken = await shareTokenFromAdmin(adminToken);
    await db.prepare("INSERT OR IGNORE INTO cabinet_links (cabinet_id, admin_token, admin_token_hash, share_token_hash) VALUES (?, ?, ?, ?)")
      .bind(id, adminToken, await hashToken(adminToken), await hashToken(shareToken)).run();
    const stored = await db.prepare("SELECT admin_token FROM cabinet_links WHERE cabinet_id = ?").bind(id).first<{ admin_token: string }>();
    if (!stored) throw new Error("Missing cabinet links");
    const origin = publicOrigin(request);
    return Response.json({ adminUrl: `${origin}/manage/${stored.admin_token}`, shareUrl: `${origin}/c/${await shareTokenFromAdmin(stored.admin_token)}` }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return jsonError("获取链接失败，请稍后重试。", 500); }
}
