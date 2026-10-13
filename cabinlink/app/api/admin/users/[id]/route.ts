import { requireAdmin } from "@/lib/admin-server";
import { passwordHash, sameOrigin, validPassword } from "@/lib/auth-server";
import { jsonError, newToken, requireStorage } from "@/lib/cabinet-server";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return jsonError("请求来源无效。",403);
  try {
    const auth = await requireAdmin(request); if (auth.response) return auth.response;
    const {id} = await context.params; const {db} = requireStorage();
    const user = await db.prepare("SELECT id,role,username FROM users WHERE id=?").bind(id).first<{id:string;role:string;username:string|null}>();
    if (!user) return jsonError("用户不存在。",404);
    if (user.role === "admin") return jsonError("后台不能修改管理员账号，请使用个人设置或数据库管理。",403);
    const body = await request.json() as {action?:unknown;password?:unknown;reason?:unknown};
    const now = new Date().toISOString(); const statements: D1PreparedStatement[] = []; let detail = "";
    switch(body.action) {
      case "password": {
        if (!validPassword(body.password)) return jsonError("密码须为 8–128 位，同时包含英文字母和数字。");
        const salt = newToken(); const digest = await passwordHash(body.password as string,salt);
        statements.push(db.prepare("UPDATE users SET password_salt=?,password_hash=? WHERE id=? AND role='user'").bind(salt,digest,id)); break;
      }
      case "ban": {
        if (typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 200) return jsonError("请填写封禁原因（最多 200 字）。");
        detail = body.reason.trim(); statements.push(db.prepare("UPDATE users SET banned_at=?,ban_reason=? WHERE id=? AND role='user'").bind(now,detail,id)); break;
      }
      case "unban": statements.push(db.prepare("UPDATE users SET banned_at=NULL,ban_reason=NULL WHERE id=? AND role='user'").bind(id)); break;
      case "logout": break;
      default: return jsonError("不支持的管理操作。");
    }
    if (body.action !== "unban") {
      statements.push(db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id));
      statements.push(db.prepare("UPDATE email_codes SET code_hash=NULL WHERE email IN (SELECT email FROM users WHERE id=?) OR user_id=?").bind(id,id));
    }
    if (body.action === "password" && user.username) statements.push(db.prepare("DELETE FROM login_attempts WHERE username=?").bind(user.username));
    statements.push(db.prepare("INSERT INTO admin_audit_logs(id,actor_id,target_id,action,detail,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),auth.user.id,id,body.action,detail,now));
    await db.batch(statements);
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { console.error(error); return jsonError("管理操作失败，请稍后重试。",500); }
}
