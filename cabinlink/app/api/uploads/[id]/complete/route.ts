import { jsonError, requireStorage } from "@/lib/cabinet-server";
import { authorizeCabinet, sessionUser } from "@/lib/auth-server";
export async function POST(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { const user = await sessionUser(request); if (!user)
    return jsonError("请先登录", 401); const { id } = await params; const { db, bucket } = requireStorage(); const upload = await db.prepare("SELECT * FROM uploads WHERE id=? AND expires_at>?").bind(id, new Date().toISOString()).first<{
    cabinet_id: string;
    theme_id: string;
    object_key: string;
    upload_id: string;
    original_name: string;
    content_type: string;
    size_bytes: number;
    parts_json: string;
    uploader_user_id: string;
}>(); if (!upload)
    return jsonError("上传不存在或已过期", 404); if (upload.uploader_user_id !== user.id || !await authorizeCabinet(request, upload.cabinet_id))
    return jsonError("无权操作上传", 403); const claim = await db.prepare("UPDATE uploads SET completing=1 WHERE id=? AND completing=0").bind(id).run(); if (!claim.meta.changes)
    return jsonError("上传正在完成", 409); try {
    let object = await bucket.head(upload.object_key);
    if (!object) {
        const parts = JSON.parse(upload.parts_json) as R2UploadedPart[];
        if (!parts.length)
            throw Error("尚未收到分片");
        await bucket.resumeMultipartUpload(upload.object_key, upload.upload_id).complete(parts);
        object = await bucket.head(upload.object_key);
    }
    if (!object || object.size !== upload.size_bytes) {
        await bucket.delete(upload.object_key);
        await db.prepare("DELETE FROM uploads WHERE id=?").bind(id).run();
        return jsonError("实际文件大小与申报不符，请重新上传", 400);
    }
    const fileId = crypto.randomUUID(), now = new Date().toISOString();
    await db.batch([db.prepare("INSERT INTO files(id,theme_id,object_key,original_name,content_type,size_bytes,created_at,uploader_user_id) VALUES(?,?,?,?,?,?,?,?)").bind(fileId, upload.theme_id, upload.object_key, upload.original_name, upload.content_type, object.size, now, user.id), db.prepare("DELETE FROM uploads WHERE id=?").bind(id)]);
    return Response.json({ file: { id: fileId, theme_id: upload.theme_id, original_name: upload.original_name, content_type: upload.content_type, size_bytes: object.size, created_at: now } });
}
catch (e) {
    await db.prepare("UPDATE uploads SET completing=0 WHERE id=?").bind(id).run();
    console.error(e);
    return jsonError("完成上传失败，可重试", 500);
} }
