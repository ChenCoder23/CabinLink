import { sessionUser } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";

export async function GET(request: Request) {
  try {
    const user = await sessionUser(request);
    if (!user) return jsonError("请先登录。", 401);
    const { db } = requireStorage();
    type CabinetRow = { id: string; name: string; theme_count: number };
    const [created, joined] = await Promise.all([
      db.prepare("SELECT c.id, c.name, COUNT(t.id) AS theme_count FROM cabinets c LEFT JOIN themes t ON t.cabinet_id = c.id WHERE c.owner_user_id = ? AND c.closed_at IS NULL GROUP BY c.id ORDER BY c.created_at DESC").bind(user.id).all<CabinetRow>(),
      db.prepare("SELECT c.id, c.name, COUNT(t.id) AS theme_count FROM cabinet_memberships m JOIN cabinets c ON c.id = m.cabinet_id LEFT JOIN themes t ON t.cabinet_id = c.id WHERE m.user_id = ? AND c.owner_user_id != ? AND c.closed_at IS NULL GROUP BY c.id ORDER BY m.joined_at DESC").bind(user.id, user.id).all<CabinetRow>(),
    ]);
    return Response.json({ created: created.results, joined: joined.results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error(error); return jsonError("读取智能柜失败。", 500); }
}
