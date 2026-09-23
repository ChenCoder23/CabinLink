import { DEFAULT_QUOTA_BYTES, hashToken, jsonError, newToken, requireStorage, safeName, shareTokenFromAdmin } from "@/lib/cabinet-server";
import { sessionUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { name?: unknown };
    const name = safeName(payload.name, 60);
    if (!name) return jsonError("请填写智能柜名称。");
    const adminToken = newToken(); const shareToken = await shareTokenFromAdmin(adminToken); const id = crypto.randomUUID(); const themeId = crypto.randomUUID(); const now = new Date().toISOString();
    const { db } = requireStorage(); const user = await sessionUser(request);
    await db.batch([
      db.prepare("INSERT INTO cabinets (id, name, share_token_hash, admin_token_hash, quota_bytes, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, name, await hashToken(shareToken), await hashToken(adminToken), DEFAULT_QUOTA_BYTES, user?.id ?? null, now),
      db.prepare("INSERT INTO themes (id, cabinet_id, name, created_at) VALUES (?, ?, ?, ?)").bind(themeId, id, "未分类", now),
    ]);
    const origin = new URL(request.url).origin;
    return Response.json({ cabinet: { id, name }, shareUrl: `${origin}/c/${shareToken}`, adminUrl: `${origin}/manage/${adminToken}` }, { status: 201 });
  } catch (error) { console.error(error); return jsonError("创建智能柜失败，请稍后重试。", 500); }
}
