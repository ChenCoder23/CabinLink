import { sessionUser } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";

export async function GET(request: Request) { try { const user = await sessionUser(request); if (!user) return jsonError("请先登录。", 401); const { db } = requireStorage(); const result = await db.prepare("SELECT c.id, c.name, c.created_at, c.closed_at, COUNT(t.id) AS theme_count FROM cabinets c LEFT JOIN themes t ON t.cabinet_id = c.id WHERE c.owner_user_id = ? GROUP BY c.id ORDER BY c.created_at DESC").bind(user.id).all<{ id: string; name: string; created_at: string; closed_at: string | null; theme_count: number }>(); return Response.json({ cabinets: result.results }); } catch { return jsonError("读取智能柜失败。", 500); } }
