import { normalizeEmail, sameOrigin, sendEmailCode, sessionUser } from "@/lib/auth-server";
import { jsonError, requireStorage } from "@/lib/cabinet-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("请求来源无效。", 403);
  try {
    const payload = await request.json() as { email?: unknown; purpose?: unknown };
    const email = normalizeEmail(payload.email);
    if (!email || (payload.purpose !== "login" && payload.purpose !== "bind")) return jsonError("请填写有效的邮箱地址。");
    const user = payload.purpose === "bind" ? await sessionUser(request) : null;
    if (payload.purpose === "bind" && !user) return jsonError("请先登录。", 401);
    if (payload.purpose === "bind") {
      const { db } = requireStorage(); const owner = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
      if (owner && owner.id !== user?.id) return jsonError("该邮箱已绑定其他账号。", 409);
      if (user?.email === email) return jsonError("该邮箱已绑定当前账号。", 409);
    }
    const result = await sendEmailCode(email, payload.purpose, user?.id ?? null);
    if (result === "rate_limited") return jsonError("发送过于频繁，请稍后再试。", 429);
    if (result === "send_failed") return jsonError("验证码发送失败，请稍后再试。", 502);
    return Response.json({ ok: true });
  } catch (error) { console.error(error); return jsonError("验证码服务暂不可用。", 503); }
}
