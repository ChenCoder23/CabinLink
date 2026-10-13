import { env } from 'cloudflare:workers';
import { publishDue } from '@/lib/word-scheduler';
export async function POST(r: Request) { const secret = (env as unknown as {
    WORD_SCHEDULER_SECRET?: string;
}).WORD_SCHEDULER_SECRET; if (!secret || r.headers.get('authorization') !== `Bearer ${secret}`)
    return new Response(null, { status: 404 }); return Response.json(await publishDue(), { headers: { 'Cache-Control': 'no-store' } }); }
