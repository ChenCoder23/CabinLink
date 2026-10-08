import { sameOrigin, sessionUser } from "@/lib/auth-server";
import { jsonError, requireStorage, resolveCabinet } from "@/lib/cabinet-server";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
    const user = await sessionUser(request);
    if (!user) return jsonError("请先登录。", 401);
    const { token } = await params;
    const cabinet = await resolveCabinet(token);
    if (!cabinet) return jsonError("智能柜不存在、已关闭或链接无效。", 404);
    const { db } = requireStorage();
    await db.prepare("INSERT OR IGNORE INTO cabinet_memberships (cabinet_id, user_id, joined_at) VALUES (?, ?, ?)").bind(cabinet.id, user.id, new Date().toISOString()).run();
    return Response.json({ cabinet: { id: cabinet.id, name: cabinet.name } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error(error); return jsonError("加入智能柜失败。", 500); }
}
