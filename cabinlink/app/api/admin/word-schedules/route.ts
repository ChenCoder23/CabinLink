import ExcelJS from 'exceljs';
import { requireAdmin, adminHeaders } from '@/lib/admin-server';
import { sameOrigin } from '@/lib/auth-server';
import { jsonError, requireStorage } from '@/lib/cabinet-server';
import { publishDue } from '@/lib/word-scheduler';
export async function GET(r: Request) { const auth = await requireAdmin(r); if (auth.response)
    return auth.response; const { db } = requireStorage(); const [libraries, schedules, runs] = await Promise.all([db.prepare('SELECT l.*,c.name category_name FROM word_libraries l JOIN word_categories c ON c.id=l.category_id ORDER BY l.created_at DESC').all(), db.prepare('SELECT * FROM word_schedules ORDER BY created_at DESC').all(), db.prepare('SELECT * FROM word_schedule_runs ORDER BY created_at DESC LIMIT 100').all()]); return Response.json({ libraries: libraries.results, schedules: schedules.results, runs: runs.results }, { headers: adminHeaders }); }
export async function POST(r: Request) {
    if (!sameOrigin(r))
        return jsonError('请求来源无效', 403);
    const auth = await requireAdmin(r);
    if (auth.response)
        return auth.response;
    const { db } = requireStorage();
    if (r.headers.get('content-type')?.includes('multipart/form-data')) {
        const form = await r.formData(), file = form.get('file'), category = form.get('category');
        if (!(file instanceof File) || file.size > 20 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx') || typeof category !== 'string' || !await db.prepare('SELECT id FROM word_categories WHERE id=?').bind(category).first())
            return jsonError('请选择分类与20MB以内的.xlsx文件');
        const id = crypto.randomUUID();
        await db.prepare('INSERT INTO word_libraries(id,category_id,uploader_id,name,created_at) VALUES(?,?,?,?,?)').bind(id, category, auth.user!.id, file.name.slice(0, 180), new Date().toISOString()).run();
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const sheet = workbook.worksheets[0];
            if (!sheet || sheet.getCell('A1').text.trim() !== '英文' || sheet.getCell('B1').text.trim() !== '中文意思')
                throw Error('表头必须为“英文”“中文意思”');
            if (sheet.rowCount - 1 > 50000)
                throw Error('最多50000行');
            const rows: {
                english: string;
                chinese: string;
            }[] = [], errors: string[] = [], seen = new Set<string>();
            for (let n = 2; n <= sheet.rowCount; n++) {
                const row = sheet.getRow(n);
                if (!row.hasValues)
                    continue;
                const english = row.getCell(1).text.trim(), chinese = row.getCell(2).text.trim();
                if (!english || !chinese || english.length > 200 || chinese.length > 1000 || row.getCell(1).type === ExcelJS.ValueType.Formula || row.getCell(2).type === ExcelJS.ValueType.Formula)
                    errors.push(`第${n}行：单词和释义不能为空，不支持公式，长度最多200/1000字`);
                else if (seen.has(english.toLowerCase()))
                    errors.push(`第${n}行：重复单词 ${english}`);
                seen.add(english.toLowerCase());
                rows.push({ english, chinese });
            }
            if (!rows.length)
                errors.push('词库为空');
            if (errors.length)
                throw Error(errors.slice(0, 100).join('\n'));
            await db.prepare('UPDATE word_libraries SET total=? WHERE id=?').bind(rows.length, id).run();
            for (let i = 0; i < rows.length; i += 100) {
                await db.batch(rows.slice(i, i + 100).map((word, j) => db.prepare('INSERT INTO word_library_entries(library_id,position,english,chinese) VALUES(?,?,?,?)').bind(id, i + j, word.english, word.chinese)));
                await db.prepare('UPDATE word_libraries SET imported=? WHERE id=?').bind(Math.min(i + 100, rows.length), id).run();
            }
            await db.prepare("UPDATE word_libraries SET status='ready' WHERE id=?").bind(id).run();
            return Response.json({ id, total: rows.length }, { headers: adminHeaders });
        }
        catch (e) {
            const error = e instanceof Error ? e.message : '导入失败';
            await db.prepare("UPDATE word_libraries SET status='failed',error=? WHERE id=?").bind(error, id).run();
            return jsonError(error);
        }
    }
    const b = await r.json() as {
        action: string;
        id: string;
        status: string;
        library_id: string;
        start_date: string;
        publish_time: string;
        daily_count: number;
    };
    if (b.action === 'run')
        return Response.json(await publishDue(), { headers: adminHeaders });
    if (b.action === 'status') {
        if (!['active', 'paused'].includes(b.status))
            return jsonError('状态无效');
        await db.prepare("UPDATE word_schedules SET status=? WHERE id=? AND status!='finished'").bind(b.status, b.id).run();
        return Response.json({ ok: true });
    }
    if (b.action === 'save' || b.action === 'preview') {
        if (typeof b.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.start_date) || !Number.isFinite(Date.parse(b.start_date + 'T00:00:00Z')) || typeof b.publish_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.publish_time) || !Number.isInteger(b.daily_count) || b.daily_count < 1 || b.daily_count > 500)
            return jsonError('请设置开始日期、北京时间与每天1–500个单词');
        const library = await db.prepare("SELECT * FROM word_libraries WHERE id=? AND status='ready'").bind(b.library_id).first<{
            total: number;
        }>();
        if (!library)
            return jsonError('词库尚未导入完成');
        const days = Math.ceil(library.total / b.daily_count);
        if (b.action === 'preview')
            return Response.json({ days, total: library.total, last_date: new Date(Date.parse(b.start_date + 'T00:00:00Z') + (days - 1) * 86400000).toISOString().slice(0, 10), sample: (await db.prepare('SELECT english,chinese FROM word_library_entries WHERE library_id=? ORDER BY position LIMIT ?').bind(b.library_id, b.daily_count).all()).results });
        const existing = await db.prepare('SELECT id FROM word_schedules WHERE library_id=?').bind(b.library_id).first<{
            id: string;
        }>();
        if (existing && await db.prepare('SELECT id FROM word_schedule_runs WHERE schedule_id=? LIMIT 1').bind(existing.id).first())
            return jsonError('已发布排程不可改分批规则，可以暂停或导入新词库');
        await db.prepare("INSERT INTO word_schedules(id,library_id,start_date,publish_time,daily_count,status,created_at) VALUES(?,?,?,?,?,'active',?) ON CONFLICT(library_id) DO UPDATE SET start_date=excluded.start_date,publish_time=excluded.publish_time,daily_count=excluded.daily_count,status='active'").bind(existing?.id || crypto.randomUUID(), b.library_id, b.start_date, b.publish_time, b.daily_count, new Date().toISOString()).run();
        return Response.json({ ok: true }, { headers: adminHeaders });
    }
    return jsonError('未知操作');
}
