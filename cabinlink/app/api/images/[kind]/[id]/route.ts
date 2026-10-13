import { sessionUser } from '@/lib/auth-server';
import { workbenchUser } from '@/lib/personal-server';
import { requireStorage } from '@/lib/cabinet-server';
export async function GET(r: Request, { params }: {
    params: Promise<{
        kind: string;
        id: string;
    }>;
}) {
    const { kind, id } = await params;
    if (!['avatar', 'banner', 'poster', 'workbench'].includes(kind) || !/^[a-f0-9-]{36}$/.test(id))
        return new Response(null, { status: 404 });
    const { db, bucket } = requireStorage();
    const url = `/api/images/${kind}/${id}`;
    let visible = false;
    if (kind === 'banner')
        visible = !!await db.prepare('SELECT id FROM site_settings WHERE hero_background=? AND id=1').bind(url).first();
    else {
        const user = kind === 'poster' || kind === 'workbench' ? await workbenchUser(r) : await sessionUser(r);
        if (user)
            visible = kind === 'workbench' ? !!await db.prepare('SELECT user_id FROM workbench_profile WHERE user_id=? AND hero_background=?').bind(user.id,url).first() : kind === 'poster' ? !!await db.prepare('SELECT id FROM workbench_tasks WHERE user_id=? AND poster=? LIMIT 1').bind(user.id, url).first() : !!await db.prepare('SELECT id FROM users WHERE id=? AND avatar_url=?').bind(user.id, url).first();
    }
    if (!visible)
        return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const object = await bucket.get(`images/${kind}/${id}`);
    if (!object)
        return new Response(null, { status: 404 });
    return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': kind === 'banner' ? 'public, max-age=300' : 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
