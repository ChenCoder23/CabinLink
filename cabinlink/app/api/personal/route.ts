import { validImage } from "@/lib/image-validation";
import { storeImage, deleteUnusedImage } from '@/lib/image-storage';
import { sameOrigin, sessionUser, validPassword, passwordHash } from "@/lib/auth-server";
import { jsonError, requireStorage, newToken } from "@/lib/cabinet-server";
import { quota, UNBOUND_QUOTA } from "@/lib/personal-server";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user)
        return jsonError("请先登录", 401);
    return Response.json({ user, ...await quota(user.id), limit: user.email ? null : UNBOUND_QUOTA }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PUT(request: Request) {
    if (!sameOrigin(request))
        return jsonError("请求来源无效", 403);
    const user = await sessionUser(request);
    if (!user)
        return jsonError("请先登录", 401);
    const body = await request.json() as {
        avatar?: unknown;
        password?: unknown;
        currentPassword?: unknown;
    };
    const { db } = requireStorage();
    if (body.avatar !== undefined) {
        if (!validImage(body.avatar))
            return jsonError("头像须为2MB以内的PNG/JPEG/WebP图片");
        const url = await storeImage(body.avatar, 'avatar');
        await db.prepare("UPDATE users SET avatar_url=? WHERE id=?").bind(url, user.id).run();
        await deleteUnusedImage(user.avatar_url);
    }
    else if (body.password !== undefined) {
        if (!validPassword(body.password))
            return jsonError("密码须为8–128位，同时含英文字母和数字");
        const row = await db.prepare("SELECT password_hash,password_salt FROM users WHERE id=?").bind(user.id).first<{
            password_hash: string | null;
            password_salt: string | null;
        }>();
        if (row?.password_hash && (typeof body.currentPassword !== "string" || await passwordHash(body.currentPassword, row.password_salt!) !== row.password_hash))
            return jsonError("当前密码不正确", 403);
        const salt = newToken();
        await db.batch([db.prepare("UPDATE users SET password_salt=?,password_hash=? WHERE id=?").bind(salt, await passwordHash(body.password as string, salt), user.id), db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)]);
        return Response.json({ ok: true, relogin: true });
    }
    else
        return jsonError("未知操作");
    return Response.json({ ok: true });
}
