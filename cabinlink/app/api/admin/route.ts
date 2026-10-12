import { requireAdmin, adminHeaders } from "@/lib/admin-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request); if (auth.response) return auth.response;
    const { db } = requireStorage(); const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().slice(0, 100) || "";
    const page = Math.max(1, Math.min(100000, Number(url.searchParams.get("page")) || 1));
    const filter = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    const where = "WHERE COALESCE(u.username,'') LIKE ? ESCAPE '\\' OR COALESCE(u.email,'') LIKE ? ESCAPE '\\' OR u.id LIKE ? ESCAPE '\\'";
    const [stats, count, users, logs, cabinets] = await Promise.all([
      db.prepare(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM users WHERE banned_at IS NOT NULL) AS banned, (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE expires_at > ? AND user_id IN (SELECT id FROM users WHERE banned_at IS NULL)) AS active, (SELECT COUNT(*) FROM cabinets) AS cabinets, (SELECT COUNT(*) FROM files) AS files, (SELECT COALESCE(SUM(size_bytes),0) FROM files) AS bytes, (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS newUsers`).bind(new Date().toISOString(),new Date(Date.now()-7*86400000).toISOString()).first(),
      db.prepare(`SELECT COUNT(*) AS total FROM users u ${where}`).bind(filter,filter,filter).first(),
      db.prepare(`SELECT u.id,u.username,u.email,u.role,u.banned_at,u.ban_reason,u.created_at, (SELECT MAX(created_at) FROM sessions WHERE user_id=u.id) AS last_login, (SELECT COUNT(*) FROM cabinets WHERE owner_user_id=u.id) AS cabinet_count, (SELECT COUNT(*) FROM cabinet_memberships WHERE user_id=u.id) AS joined_count, (SELECT COALESCE(SUM(f.size_bytes),0) FROM files f JOIN themes t ON t.id=f.theme_id JOIN cabinets c ON c.id=t.cabinet_id WHERE c.owner_user_id=u.id) AS bytes FROM users u ${where} ORDER BY u.created_at DESC,u.id LIMIT 20 OFFSET ?`).bind(filter,filter,filter,(Math.floor(page)-1)*20).all(),
      db.prepare(`SELECT l.*,a.username AS actor_name,u.username AS target_name FROM admin_audit_logs l LEFT JOIN users a ON a.id=l.actor_id LEFT JOIN users u ON u.id=l.target_id ORDER BY l.created_at DESC LIMIT 50`).all(),
      db.prepare(`SELECT c.id,c.name,c.closed_at,c.created_at,u.username AS owner_name,(SELECT COUNT(*) FROM files f JOIN themes t ON t.id=f.theme_id WHERE t.cabinet_id=c.id) AS file_count,(SELECT COALESCE(SUM(f.size_bytes),0) FROM files f JOIN themes t ON t.id=f.theme_id WHERE t.cabinet_id=c.id) AS bytes FROM cabinets c LEFT JOIN users u ON u.id=c.owner_user_id ORDER BY c.created_at DESC LIMIT 50`).all()
    ]);
    return Response.json({stats,count,users:users.results,logs:logs.results,cabinets:cabinets.results}, {headers:adminHeaders});
  } catch(error) { console.error(error); return jsonError("后台数据读取失败。",500); }
}
