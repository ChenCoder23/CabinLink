import { CHUNK_SIZE, jsonError, requireStorage } from "@/lib/cabinet-server";
import { authorizeCabinet, sessionUser } from "@/lib/auth-server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; partNumber: string }> }) {
  try {
    if (!await sessionUser(request)) return jsonError("请先登录。", 401);
    const { id, partNumber } = await params; const part = Number(partNumber); if (!Number.isInteger(part) || part < 1 || !request.body) return jsonError("上传分片无效。"); const { db, bucket } = requireStorage(); const upload = await db.prepare("SELECT * FROM uploads WHERE id = ? AND expires_at > ?").bind(id, new Date().toISOString()).first<{ cabinet_id: string; upload_id: string; object_key: string; parts_json: string }>(); if (!upload) return jsonError("上传已过期，请重新选择文件。", 404); const cabinet = await authorizeCabinet(request, upload.cabinet_id); if (!cabinet) return jsonError("智能柜链接无效。", 403);
    const length = Number(request.headers.get("content-length") || 0); if (!length || length > CHUNK_SIZE) return jsonError("上传分片大小无效。"); const multipart = bucket.resumeMultipartUpload(upload.object_key, upload.upload_id); const result = await multipart.uploadPart(part, request.body); const parts = JSON.parse(upload.parts_json) as { partNumber: number; etag: string }[]; const next = [...parts.filter((item) => item.partNumber !== part), { partNumber: part, etag: result.etag }].sort((a, b) => a.partNumber - b.partNumber); await db.prepare("UPDATE uploads SET parts_json = ? WHERE id = ?").bind(JSON.stringify(next), id).run(); return Response.json({ etag: result.etag });
  } catch (error) { console.error(error); return jsonError("上传分片失败，可重试该文件。", 500); }
}
