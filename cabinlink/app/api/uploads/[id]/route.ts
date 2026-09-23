import { jsonError, requireStorage } from "@/lib/cabinet-server";
import { authorizeCabinet } from "@/lib/auth-server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const { db, bucket } = requireStorage(); const upload = await db.prepare("SELECT cabinet_id, object_key, upload_id FROM uploads WHERE id = ?").bind(id).first<{ cabinet_id: string; object_key: string; upload_id: string }>(); if (upload) { const cabinet = await authorizeCabinet(request, upload.cabinet_id); if (!cabinet) return jsonError("智能柜链接无效。", 403); await bucket.resumeMultipartUpload(upload.object_key, upload.upload_id).abort(); await db.prepare("DELETE FROM uploads WHERE id = ?").bind(id).run(); } return Response.json({ ok: true }); } catch (error) { console.error(error); return jsonError("取消上传失败。", 500); }
}
