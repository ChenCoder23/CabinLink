import { authorizeCabinet } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const cabinet = await authorizeCabinet(request, id, "admin"); if (!cabinet) return jsonError("请先登录对应账号。", 403); const { db } = requireStorage(); await db.prepare("UPDATE cabinets SET closed_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run(); return Response.json({ ok: true }); } catch { return jsonError("关闭智能柜失败。", 500); } }
