import { requireStorage } from '@/lib/cabinet-server';
type Schedule = {
    id: string;
    library_id: string;
    start_date: string;
    publish_time: string;
    daily_count: number;
    total: number;
    category_id: string;
    uploader_id: string;
};
export async function publishDue(now = new Date()) {
    const { db } = requireStorage();
    const local = new Date(now.getTime() + 8 * 3600000).toISOString(), today = local.slice(0, 10), time = local.slice(11, 16);
    let published = 0;
    const schedules = (await db.prepare("SELECT s.*,l.total,l.category_id,l.uploader_id FROM word_schedules s JOIN word_libraries l ON l.id=s.library_id WHERE s.status='active' AND l.status='ready'").all<Schedule>()).results;
    for (const s of schedules) {
        const days = Math.ceil(s.total / s.daily_count);
        for (let day = 0; day < days; day++) {
            const date = new Date(Date.parse(s.start_date + 'T00:00:00Z') + day * 86400000).toISOString().slice(0, 10);
            if (date > today || (date === today && time < s.publish_time))
                break;
            const id = `${s.id}:${date}`;
            if (await db.prepare('SELECT id FROM word_schedule_runs WHERE id=?').bind(id).first())
                continue;
            const offset = day * s.daily_count, count = Math.min(s.daily_count, s.total - offset), stamp = now.toISOString();
            try {
                await db.batch([db.prepare('INSERT INTO word_batches(id,category_id,study_date,uploaded_at,uploader_id) VALUES(?,?,?,?,?)').bind(id, s.category_id, date, stamp, s.uploader_id), db.prepare("INSERT INTO word_entries(id,batch_id,english,chinese) SELECT ? || ':' || position,?,english,chinese FROM word_library_entries WHERE library_id=? AND position>=? AND position<? ORDER BY position").bind(id, id, s.library_id, offset, offset + count), db.prepare('INSERT INTO word_schedule_runs(id,schedule_id,study_date,batch_id,count,created_at) VALUES(?,?,?,?,?,?)').bind(id, s.id, date, id, count, stamp)]);
                published += count;
            }
            catch (e) {
                if (!await db.prepare('SELECT id FROM word_schedule_runs WHERE id=?').bind(id).first())
                    throw e;
            }
        }
        const done = await db.prepare('SELECT COUNT(*) n FROM word_schedule_runs WHERE schedule_id=?').bind(s.id).first<{
            n: number;
        }>();
        if (done?.n === days)
            await db.prepare("UPDATE word_schedules SET status='finished' WHERE id=? AND status='active'").bind(s.id).run();
    }
    return { published };
}
