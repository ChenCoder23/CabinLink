import { createSession, passwordHash, sameOrigin, sessionCookie, validPassword, validUsername } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
  try {
    const payload = await request.json() as { username?: unknown; password?: unknown };
    if (!validUsername(payload.username) || !validPassword(payload.password)) return jsonError("账号或密码不正确。", 401);
    const username = payload.username as string; const password = payload.password as string;
    const { db } = requireStorage(); const now = new Date().toISOString();
    const attempts = await db.prepare("SELECT attempts, window_started_at FROM login_attempts WHERE username = ?").bind(username).first<{ attempts: number; window_started_at: string }>();
    if (attempts && Date.now() - Date.parse(attempts.window_started_at) < 900_000 && attempts.attempts >= 5) return jsonError("登录尝试过多，请 15 分钟后再试。", 429);
    const user = await db.prepare("SELECT id, username, email, password_salt, password_hash FROM users WHERE username = ? LIMIT 1").bind(username).first<{ id: string; username: string; email: string | null; password_salt: string | null; password_hash: string | null }>();
    if (!user?.password_salt || !user.password_hash || (await passwordHash(password, user.password_salt)) !== user.password_hash) {
      if (!attempts || Date.now() - Date.parse(attempts.window_started_at) >= 900_000) await db.prepare("INSERT INTO login_attempts (username, attempts, window_started_at) VALUES (?, 1, ?) ON CONFLICT(username) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at").bind(username, now).run();
      else await db.prepare("UPDATE login_attempts SET attempts = attempts + 1 WHERE username = ?").bind(username).run();
      return jsonError("账号或密码不正确。", 401);
    }
    await db.prepare("DELETE FROM login_attempts WHERE username = ?").bind(username).run();
    const session = await createSession(user.id);
    return Response.json({ user: { id: user.id, username: user.username, email: user.email } }, { headers: { "Set-Cookie": sessionCookie(session.token, request) } });
  } catch (error) { console.error(error); return jsonError("登录失败，请稍后重试。", 500); }
}
