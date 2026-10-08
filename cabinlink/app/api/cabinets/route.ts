import { DEFAULT_QUOTA_BYTES, hashToken, jsonError, newToken, requireStorage, safeName, shareTokenFromAdmin } from "@/lib/cabinet-server";
import { publicOrigin, sessionUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const user = await sessionUser(request);
    if (!user) return jsonError("请先登录。", 401);
    const payload = await request.json() as { name?: unknown };
    const name = safeName(payload.name, 60);
    if (!name) return jsonError("请填写智能柜名称。");
    const adminToken = newToken(); const shareToken = await shareTokenFromAdmin(adminToken); const id = crypto.randomUUID(); const themeId = crypto.randomUUID(); const now = new Date().toISOString();
    const { db } = requireStorage();
    await db.batch([
      db.prepare("INSERT INTO cabinets (id, name, share_token_hash, admin_token_hash, quota_bytes, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, name, await hashToken(shareToken), await hashToken(adminToken), DEFAULT_QUOTA_BYTES, user.id, now),
      db.prepare("INSERT INTO themes (id, cabinet_id, name, created_at) VALUES (?, ?, ?, ?)").bind(themeId, id, "未分类", now),
    ]);
    const origin = publicOrigin(request);
    return Response.json({ cabinet: { id, name }, shareUrl: `${origin}/c/${shareToken}`, adminUrl: `${origin}/manage/${adminToken}` }, { status: 201 });
  } catch (error) { console.error(error); return jsonError("创建智能柜失败，请稍后重试。", 500); }
}
