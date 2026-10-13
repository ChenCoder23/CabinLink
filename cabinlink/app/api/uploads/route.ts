import { MAX_FILE_BYTES, fileKey, jsonError, requireStorage, safeName } from "@/lib/cabinet-server";
import { authorizeCabinet, sessionUser, sameOrigin } from "@/lib/auth-server";

export async function POST(request: Request) {
  if(!sameOrigin(request))return jsonError("请求来源无效",403);
  try {
    const user=await sessionUser(request); if (!user) return jsonError("请先登录。", 401);
    const payload = await request.json() as { cabinetId?: string; themeId?: string; name?: unknown; contentType?: unknown; size?: unknown };
    const cabinet = await authorizeCabinet(request, payload.cabinetId ?? ""); if (!cabinet) return jsonError("智能柜链接无效。", 403);
    const name = safeName(payload.name, 180); const size = typeof payload.size === "number" ? payload.size : 0; const contentType = typeof payload.contentType === "string" && payload.contentType.length < 160 ? payload.contentType : "application/octet-stream";
    if (!payload.themeId || !name || !Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) return jsonError("文件信息无效，单个文件最大 1GB。");
    const { db, bucket } = requireStorage(); const theme = await db.prepare("SELECT id FROM themes WHERE id = ? AND cabinet_id = ?").bind(payload.themeId, cabinet.id).first(); if (!theme) return jsonError("请选择当前智能柜中的主题。", 404);
    const now = new Date(); const expired=await db.prepare("SELECT id,object_key,upload_id FROM uploads WHERE expires_at<=?").bind(now.toISOString()).all<{id:string;object_key:string;upload_id:string}>();for(const old of expired.results){try{await bucket.resumeMultipartUpload(old.object_key,old.upload_id).abort();}catch{} await db.prepare("DELETE FROM uploads WHERE id=?").bind(old.id).run();}
    const reserved = await db.prepare("SELECT COALESCE((SELECT SUM(f.size_bytes) FROM files f JOIN themes t ON t.id = f.theme_id WHERE t.cabinet_id = ?), 0) + COALESCE((SELECT SUM(size_bytes) FROM uploads WHERE cabinet_id = ?), 0) AS total").bind(cabinet.id, cabinet.id).first<{ total: number }>();
    if ((reserved?.total ?? 0) + size > cabinet.quota_bytes) return jsonError("智能柜容量不足（总容量 10GB）。", 413);
    const id = crypto.randomUUID(); const objectKey = fileKey(cabinet.id, id); const multipart = await bucket.createMultipartUpload(objectKey, { httpMetadata: { contentType } }); const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const reservation=await db.prepare("INSERT INTO uploads (id,cabinet_id,theme_id,object_key,upload_id,original_name,content_type,size_bytes,expires_at,created_at,uploader_user_id) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(size_bytes),0) FROM files WHERE theme_id IN (SELECT id FROM themes WHERE cabinet_id=?))+(SELECT COALESCE(SUM(size_bytes),0) FROM uploads WHERE cabinet_id=? AND expires_at>?) + ? <= ? AND (? IS NOT NULL OR (SELECT COALESCE(SUM(size_bytes),0) FROM files WHERE uploader_user_id=?)+(SELECT COALESCE(SUM(size_bytes),0) FROM uploads WHERE uploader_user_id=? AND expires_at>?) + ? <= 209715200)").bind(id,cabinet.id,payload.themeId,objectKey,multipart.uploadId,name,contentType,size,expiresAt,now.toISOString(),user.id,cabinet.id,cabinet.id,now.toISOString(),size,cabinet.quota_bytes,user.email,user.id,user.id,now.toISOString(),size).run();
    if(!reservation.meta.changes){await multipart.abort();return jsonError("上传额度不足：未绑定邮箱账号最多200MiB，请删除文件或绑定邮箱。",413);}
    return Response.json({ uploadId: id, chunkSize: 10 * 1024 * 1024 });
  } catch (error) { console.error(error); return jsonError("初始化上传失败。", 500); }
}
