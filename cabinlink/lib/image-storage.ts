import { requireStorage } from '@/lib/cabinet-server';
export type ImageKind = 'avatar' | 'banner' | 'poster' | 'workbench';
export async function storeImage(value: string, kind: ImageKind) { if (!value || value.startsWith('/api/images/'))
    return value; const { bucket } = requireStorage(); const match = /^data:(image\/(?:png|jpeg|webp));base64,(.*)$/.exec(value)!; const binary = atob(match[2]); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); const id = crypto.randomUUID(); await bucket.put(`images/${kind}/${id}`, bytes, { httpMetadata: { contentType: match[1] } }); return `/api/images/${kind}/${id}`; }
export async function deleteUnusedImage(url: string) { const match = /^\/api\/images\/(avatar|banner|poster|workbench)\/([a-f0-9-]{36})$/.exec(url); if (!match)
    return; const { db, bucket } = requireStorage(); const query = match[1] === 'avatar' ? 'SELECT id FROM users WHERE avatar_url=? LIMIT 1' : match[1] === 'banner' ? 'SELECT id FROM site_settings WHERE hero_background=? LIMIT 1' : match[1] === 'workbench' ? 'SELECT user_id FROM workbench_profile WHERE hero_background=? LIMIT 1' : 'SELECT id FROM workbench_tasks WHERE poster=? LIMIT 1'; if (!await db.prepare(query).bind(url).first())
    await bucket.delete(`images/${match[1]}/${match[2]}`); }
