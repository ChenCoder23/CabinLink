import { requireStorage } from "@/lib/cabinet-server";
import { sessionUser } from "@/lib/auth-server";
export const UNBOUND_QUOTA = 200 * 1024 * 1024;
export async function workbenchUser(request: Request) { const user = await sessionUser(request); if (!user)
    return null; const { db } = requireStorage(); const owner = await db.prepare("SELECT user_id FROM workbench_owner WHERE id=1").first<{
    user_id: string;
}>(); return owner?.user_id === user.id ? user : null; }
export async function quota(userId: string) { const { db } = requireStorage(); return await db.prepare("SELECT COALESCE((SELECT SUM(size_bytes) FROM files WHERE uploader_user_id=?),0) used, COALESCE((SELECT SUM(size_bytes) FROM uploads WHERE uploader_user_id=? AND expires_at>?),0) reserved").bind(userId, userId, new Date().toISOString()).first<{
    used: number;
    reserved: number;
}>(); }
