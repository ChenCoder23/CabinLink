import { consumeEmailCode, createSession, normalizeEmail, sameOrigin, sessionCookie, sessionUser } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
  try {
    const payload = await request.json() as { email?: unknown; code?: unknown; purpose?: unknown };
    const email = normalizeEmail(payload.email);
    if (!email || (payload.purpose !== "login" && payload.purpose !== "bind")) return jsonError("请填写有效的邮箱地址。");
    const user = payload.purpose === "bind" ? await sessionUser(request) : null;
    if (payload.purpose === "bind" && !user) return jsonError("请先登录。", 401);
    if (!await consumeEmailCode(email, payload.purpose, payload.code, user?.id ?? null)) return jsonError("验证码无效或已过期。", 400);
    const { db } = requireStorage();
    if (payload.purpose === "bind" && user) {
      const owner = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
      if (owner && owner.id !== user.id) return jsonError("该邮箱已绑定其他账号。", 409);
      try { await db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, user.id).run(); }
      catch { return jsonError("该邮箱已绑定其他账号。", 409); }
      return Response.json({ user: { ...user, email } });
    }
    let found = await db.prepare("SELECT id, username, email FROM users WHERE email = ?").bind(email).first<{ id: string; username: string | null; email: string }>();
    if (!found) {
      const id = crypto.randomUUID();
      try { await db.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(id, email, new Date().toISOString()).run(); found = { id, username: null, email }; }
      catch { found = await db.prepare("SELECT id, username, email FROM users WHERE email = ?").bind(email).first<{ id: string; username: string | null; email: string }>(); }
    }
    if (!found) return jsonError("登录失败，请稍后重试。", 500);
    const session = await createSession(found.id);
    return Response.json({ user: found }, { headers: { "Set-Cookie": sessionCookie(session.token, request) } });
  } catch (error) { console.error(error); return jsonError("验证码校验失败，请稍后重试。", 500); }
}
