import { jsonError, requireStorage, safeName } from "@/lib/cabinet-server";
import { authorizeCabinet, sessionUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    if (!await sessionUser(request)) return jsonError("请先登录。", 401);
    const payload = await request.json() as { cabinetId?: string; name?: unknown };
    const cabinet = await authorizeCabinet(request, payload.cabinetId ?? "", "admin"); const name = safeName(payload.name, 60);
    if (!cabinet) return jsonError("只有创建者可以新建主题。", 403); if (!name) return jsonError("请填写主题名称。");
    const theme = { id: crypto.randomUUID(), name, created_at: new Date().toISOString() }; const { db } = requireStorage();
    await db.prepare("INSERT INTO themes (id, cabinet_id, name, created_at) VALUES (?, ?, ?, ?)").bind(theme.id, cabinet.id, theme.name, theme.created_at).run();
    return Response.json({ theme: { ...theme, files: [] } }, { status: 201 });
  } catch (error) { console.error(error); return jsonError("创建主题失败。", 500); }
}
