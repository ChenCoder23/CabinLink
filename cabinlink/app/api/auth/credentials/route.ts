import { passwordHash, sameOrigin, sessionUser, validPassword, validUsername } from "@/lib/auth-server";
import { jsonError, newToken, requireStorage } from "@/lib/cabinet-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
  try {
    const user = await sessionUser(request); if (!user) return jsonError("请先登录。", 401);
    const payload = await request.json() as { username?: unknown; password?: unknown };
    if (!validUsername(payload.username)) return jsonError("账号需为 3–32 位中文、字母、数字、下划线或短横线。");
    if (!validPassword(payload.password)) return jsonError("密码长度需为 6–128 位。");
    const { db } = requireStorage(); const salt = newToken();
    try {
      const result = await db.prepare("UPDATE users SET username = ?, password_salt = ?, password_hash = ? WHERE id = ? AND username IS NULL AND password_hash IS NULL").bind(payload.username, salt, await passwordHash(payload.password as string, salt), user.id).run();
      if (!result.meta.changes) return jsonError("此账号已设置账号密码。", 409);
    } catch { return jsonError("该账号已被使用。", 409); }
    return Response.json({ user: { ...user, username: payload.username } });
  } catch (error) { console.error(error); return jsonError("设置账号密码失败。", 500); }
}
