import { createSession, passwordHash, sameOrigin, sessionCookie, validPassword, validUsername } from "@/lib/auth-server";
import { jsonError, newToken, requireStorage } from "@/lib/cabinet-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
  try {
    const payload = await request.json() as { username?: unknown; password?: unknown };
    if (!validUsername(payload.username)) return jsonError("账号需为 3–32 位中文、字母、数字、下划线或短横线。");
    if (!validPassword(payload.password)) return jsonError("密码长度需为 6–128 位。");
    const username = payload.username as string; const password = payload.password as string;
    const { db } = requireStorage();
    const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (existing) return jsonError("该账号已被使用。", 409);
    const id = crypto.randomUUID(); const salt = newToken();
    try { await db.prepare("INSERT INTO users (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, username, salt, await passwordHash(password, salt), new Date().toISOString()).run(); }
    catch { return jsonError("该账号已被使用。", 409); }
    const session = await createSession(id);
    return Response.json({ user: { id, username, email: null } }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, request) } });
  } catch (error) { console.error(error); return jsonError("注册失败，请稍后重试。", 500); }
}
