import { jsonError, requireStorage, resolveCabinet, shareTokenFromAdmin } from "@/lib/cabinet-server";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params; const cabinet = await resolveCabinet(token);
    if (!cabinet) return jsonError("智能柜不存在、已关闭或链接无效。", 404);
    const { db } = requireStorage();
    const [themeRows, fileRows, usage] = await Promise.all([
      db.prepare("SELECT id, name, created_at FROM themes WHERE cabinet_id = ? ORDER BY created_at ASC").bind(cabinet.id).all<{ id: string; name: string; created_at: string }>(),
      db.prepare("SELECT f.id, f.theme_id, f.original_name, f.content_type, f.size_bytes, f.created_at FROM files f JOIN themes t ON t.id = f.theme_id WHERE t.cabinet_id = ? ORDER BY f.created_at DESC").bind(cabinet.id).all<{ id: string; theme_id: string; original_name: string; content_type: string; size_bytes: number; created_at: string }>(),
      db.prepare("SELECT COALESCE(SUM(f.size_bytes), 0) AS used FROM files f JOIN themes t ON t.id = f.theme_id WHERE t.cabinet_id = ?").bind(cabinet.id).first<{ used: number }>(),
    ]);
    const shareUrl = cabinet.role === "admin" ? `${new URL(_.url).origin}/c/${await shareTokenFromAdmin(token)}` : undefined;
    return Response.json({ cabinet: { id: cabinet.id, name: cabinet.name, quotaBytes: cabinet.quota_bytes, usedBytes: usage?.used ?? 0, role: cabinet.role, shareUrl }, themes: themeRows.results.map((theme) => ({ ...theme, files: fileRows.results.filter((file) => file.theme_id === theme.id) })) });
  } catch (error) { console.error(error); return jsonError("读取智能柜失败，请稍后重试。", 500); }
}
