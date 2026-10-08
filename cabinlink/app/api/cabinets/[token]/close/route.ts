import { jsonError, requireStorage, resolveCabinet } from "@/lib/cabinet-server";
import { sessionUser } from "@/lib/auth-server";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!await sessionUser(_)) return jsonError("请先登录。", 401);
    const { token } = await params; const cabinet = await resolveCabinet(token, "admin");
    if (!cabinet) return jsonError("管理链接无效。", 403);
    const { db } = requireStorage(); await db.prepare("UPDATE cabinets SET closed_at = ? WHERE id = ?").bind(new Date().toISOString(), cabinet.id).run();
    return Response.json({ ok: true });
  } catch (error) { console.error(error); return jsonError("关闭智能柜失败。", 500); }
}
