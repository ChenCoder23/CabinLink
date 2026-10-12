import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd(), scratch = await mkdtemp(path.join(tmpdir(), 'cabinlink-covers-'));
let mf;
try {
  const out = path.join(scratch, 'worker.mjs');
  await build({ stdin: { contents: `import {GET} from './app/api/auth/cabinets/route'; export default {fetch:GET};`, resolveDir: root }, bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'], alias: { '@': root }, outfile: out });
  mf = new Miniflare({ modules: true, scriptPath: out, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(x => x.endsWith('.sql')).sort()) {
    for (const sql of (await readFile(path.join('drizzle', file), 'utf8')).split(/;\s*(?:--> statement-breakpoint)?/).map(x => x.trim()).filter(Boolean)) await db.prepare(sql).run();
  }
  const now = new Date().toISOString(), hash = v => createHash('sha256').update(v).digest('hex');
  for (const id of ['owner', 'member', 'stranger']) {
    await db.prepare('INSERT INTO users(id,username,created_at) VALUES(?,?,?)').bind(id, id, now).run();
    await db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)').bind(id, id, hash(id), new Date(Date.now() + 86400000).toISOString(), now).run();
  }
  await db.prepare('INSERT INTO cabinets(id,name,share_token_hash,admin_token_hash,quota_bytes,owner_user_id,created_at) VALUES(?,?,?,?,?,?,?)').bind('cab', '柜子', 'share', 'admin', 1000, 'owner', now).run();
  for (const id of ['t1', 't2']) await db.prepare('INSERT INTO themes(id,cabinet_id,name,created_at) VALUES(?,?,?,?)').bind(id, 'cab', id, now).run();
  await db.prepare('INSERT INTO cabinet_memberships(cabinet_id,user_id,joined_at) VALUES(?,?,?)').bind('cab', 'member', now).run();
  const list = async user => {
    const response = await mf.dispatchFetch('http://localhost/', { headers: user ? { cookie: `cabinlink_session=${user}` } : {} });
    assert.equal(response.status, user ? 200 : 401);
    return response.json();
  };
  assert.equal((await list('owner')).created[0].cover_file_id, null);
  for (const [id, theme, type, date] of [['old', 't1', 'image/png', '2026-01-01'], ['new', 't2', 'image/jpeg', '2026-01-02'], ['doc', 't1', 'application/pdf', '2026-01-03']]) {
    await db.prepare('INSERT INTO files(id,theme_id,object_key,original_name,content_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?)').bind(id, theme, id, id, type, 1, date).run();
  }
  const owned = (await list('owner')).created[0];
  assert.equal(owned.cover_file_id, 'new'); assert.equal(owned.theme_count, 2);
  assert.equal((await list('member')).joined[0].cover_file_id, 'new');
  assert.deepEqual(await list('stranger'), { created: [], joined: [] });
  await list();
  await db.prepare("DELETE FROM files WHERE id = 'new'").run();
  assert.equal((await list('owner')).created[0].cover_file_id, 'old');
  await db.prepare("DELETE FROM files WHERE id = 'old'").run();
  assert.equal((await list('owner')).created[0].cover_file_id, null);
  await db.prepare('UPDATE cabinets SET closed_at=?').bind(now).run();
  assert.deepEqual(await list('member'), { created: [], joined: [] });
  console.log('PASS: empty/document-only fallback; newest image across themes; owner/member lists; deletion fallback; theme counts; session and cabinet isolation.');
} finally {
  if (mf) await mf.dispose();
  await rm(scratch, { recursive: true, force: true });
}
