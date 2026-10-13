import { validImage } from "@/lib/image-validation";
import { storeImage, deleteUnusedImage } from '@/lib/image-storage';
import { workbenchUser } from "@/lib/personal-server";
import { initializeWorkbench } from "@/lib/workbench-server";
import { requireStorage, jsonError } from "@/lib/cabinet-server";
import { sameOrigin } from "@/lib/auth-server";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(r: Request) {
    const user = await workbenchUser(r);
    if (!user)
        return jsonError("页面不存在", 404);
    await initializeWorkbench(user.id);
    const { db } = requireStorage();
    return Response.json({ profile: await db.prepare("SELECT * FROM workbench_profile WHERE user_id=?").bind(user.id).first(), tasks: (await db.prepare("SELECT * FROM workbench_tasks WHERE user_id=? ORDER BY sort_order,id").bind(user.id).all()).results }, { headers });
}
export async function POST(r: Request) {
    if (!sameOrigin(r))
        return jsonError("请求来源无效", 403);
    const user = await workbenchUser(r);
    if (!user)
        return jsonError("页面不存在", 404);
    const b = await r.json() as {
        action: string;
        id: string;
        introduction: string;
        kind: string;
        title: string;
        description: string;
        criteria: string;
        due_date: string;
        poster: string;
        progress: number;
        sort_order: number;
        focus: boolean;
        hero_title: string;
        hero_description: string;
        hero_background: string;
    };
    const { db } = requireStorage();
    if (b.action === 'banner') {
        const old = await db.prepare('SELECT hero_background FROM workbench_profile WHERE user_id=?').bind(user.id).first<{hero_background:string}>();
        if (!old || typeof b.hero_title !== 'string' || !b.hero_title.trim() || b.hero_title.length > 100 || typeof b.hero_description !== 'string' || b.hero_description.length > 500 || typeof b.hero_background !== 'string' || !(validImage(b.hero_background) || (b.hero_background === old.hero_background && /^\/api\/images\/workbench\/[a-f0-9-]{36}$/.test(b.hero_background)))) return jsonError('横幅信息无效');
        const image = await storeImage(b.hero_background, 'workbench');
        await db.prepare('UPDATE workbench_profile SET hero_title=?,hero_description=?,hero_background=? WHERE user_id=?').bind(b.hero_title.trim(),b.hero_description,image,user.id).run();
        if (old.hero_background !== image) await deleteUnusedImage(old.hero_background);
    }
    else if (b.action === 'profile') {
        if (typeof b.introduction !== 'string' || b.introduction.length > 20000)
            return jsonError('介绍最多20000字');
        await db.prepare('UPDATE workbench_profile SET introduction=? WHERE user_id=?').bind(b.introduction, user.id).run();
    }
    else if (b.action === 'seen') {
        await db.prepare('UPDATE workbench_tasks SET seen=celebration WHERE id=? AND user_id=?').bind(b.id, user.id).run();
    }
    else if (b.action === 'delete') {
        const old = await db.prepare('SELECT poster FROM workbench_tasks WHERE id=? AND user_id=?').bind(b.id, user.id).first<{
            poster: string;
        }>();
        await db.prepare('DELETE FROM workbench_tasks WHERE id=? AND user_id=?').bind(b.id, user.id).run();
        if (old)
            await deleteUnusedImage(old.poster);
    }
    else if (b.action === 'save') {
        const posterAllowed = typeof b.poster === 'string' && (validImage(b.poster) || (/^\/api\/images\/poster\/[a-f0-9-]{36}$/.test(b.poster) && !!await db.prepare('SELECT id FROM workbench_tasks WHERE user_id=? AND poster=? LIMIT 1').bind(user.id, b.poster).first()));
        if (!['main', 'side', 'long'].includes(b.kind) || typeof b.title !== 'string' || !b.title.trim() || b.title.length > 150 || !Number.isInteger(b.progress) || b.progress < 0 || b.progress > 100 || !Number.isInteger(b.sort_order) || typeof b.focus !== 'boolean' || typeof b.description !== 'string' || b.description.length > 5000 || typeof b.criteria !== 'string' || b.criteria.length > 2000 || typeof b.due_date !== 'string' || (b.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(b.due_date)) || !posterAllowed)
            return jsonError('任务信息无效');
        const id = b.id || crypto.randomUUID();
        const old = await db.prepare('SELECT id,poster FROM workbench_tasks WHERE id=? AND user_id=?').bind(id, user.id).first<{
            id: string;
            poster: string;
        }>();
        if (b.id && !old)
            return jsonError('任务不存在', 404);
        const poster = await storeImage(b.poster, 'poster');
        const result = await db.prepare(`INSERT INTO workbench_tasks(id,user_id,kind,title,description,due_date,criteria,progress,sort_order,focus,poster,celebration) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ?=0 OR (SELECT COUNT(*) FROM workbench_tasks WHERE user_id=? AND focus=1 AND id!=?)<3 ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,description=excluded.description,due_date=excluded.due_date,criteria=excluded.criteria,progress=excluded.progress,sort_order=excluded.sort_order,focus=excluded.focus,poster=excluded.poster,celebration=CASE WHEN excluded.progress=100 AND workbench_tasks.progress<100 THEN workbench_tasks.celebration+1 ELSE workbench_tasks.celebration END`).bind(id, user.id, b.kind, b.title.trim(), b.description, b.due_date, b.criteria, b.progress, b.sort_order, b.focus ? 1 : 0, poster, b.progress === 100 ? 1 : 0, b.focus ? 1 : 0, user.id, id).run();
        if (!result.meta.changes) {
            await deleteUnusedImage(poster);
            return jsonError('今日重点最多三项');
        }
        if (old && old.poster !== poster)
            await deleteUnusedImage(old.poster);
    }
    else
        return jsonError('未知操作');
    return Response.json({ ok: true }, { headers });
}
