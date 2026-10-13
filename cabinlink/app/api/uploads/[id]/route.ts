import { jsonError, requireStorage } from "@/lib/cabinet-server";
import { authorizeCabinet, sessionUser } from "@/lib/auth-server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user=await sessionUser(request); if (!user) return jsonError("请先登录。", 401); const { id } = await params; const { db, bucket } = requireStorage(); const upload = await db.prepare("SELECT cabinet_id, object_key, upload_id, uploader_user_id, completing FROM uploads WHERE id = ?").bind(id).first<{ cabinet_id: string; object_key: string; uploader_user_id: string; completing:number; upload_id: string }>(); if (upload) { if(upload.completing)return jsonError("上传正在完成，请稍后重试",409); if(upload.uploader_user_id!==user.id)return jsonError("无权操作他人上传",403); const cabinet = await authorizeCabinet(request, upload.cabinet_id); if (!cabinet) return jsonError("智能柜链接无效。", 403); await bucket.resumeMultipartUpload(upload.object_key, upload.upload_id).abort(); await db.prepare("DELETE FROM uploads WHERE id = ?").bind(id).run(); } return Response.json({ ok: true }); } catch (error) { console.error(error); return jsonError("取消上传失败。", 500); }
}
