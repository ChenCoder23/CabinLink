import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash, createHmac } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd(), scratch = await mkdtemp(path.join(tmpdir(), 'cabinlink-links-'));
let mf;
try {
  const out = path.join(scratch, 'worker.mjs');
  await build({ stdin: { contents: `import {POST as links} from './app/api/cabinets/owned/[id]/links/route'; import {POST as create} from './app/api/cabinets/route'; import {GET as settings,PUT as save} from './app/api/site-settings/route'; import {resolveCabinet} from './lib/cabinet-server'; export default {async fetch(r){const p=new URL(r.url).pathname; if(p==='/settings')return r.method==='PUT'?save(r):settings(r); if(p==='/create')return create(r); if(p.startsWith('/resolve/'))return Response.json(await resolveCabinet(p.split('/').pop())); return links(r,{params:Promise.resolve({id:p.slice(1)})});}}`, resolveDir: root }, bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'], alias: { '@': root }, outfile: out });
  mf = new Miniflare({ modules: true, scriptPath: out, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(x => x.endsWith('.sql')).sort()) {
    for (const statement of (await readFile(path.join('drizzle', file), 'utf8')).split(/;\s*(?:--> statement-breakpoint)?/).map(x => x.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  const hash = v => createHash('sha256').update(v).digest('hex');
  const now = new Date().toISOString(), expires = new Date(Date.now() + 86400000).toISOString();
  for (const [id, role] of [['owner', 'user'], ['member', 'user'], ['stranger', 'user'], ['admin', 'admin']]) {
    await db.prepare('INSERT INTO users(id,username,role,created_at) VALUES(?,?,?,?)').bind(id, id, role, now).run();
    await db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)').bind(id, id, hash(id), expires, now).run();
  }
  const oldAdmin = 'a'.repeat(43), oldShare = createHmac('sha256', oldAdmin).update('cabinlink/share-link/v1').digest('base64url');
  await db.prepare('INSERT INTO cabinets(id,name,share_token_hash,admin_token_hash,quota_bytes,owner_user_id,created_at) VALUES(?,?,?,?,?,?,?)').bind('legacy', '旧智能柜', hash(oldShare), hash(oldAdmin), 1000, 'owner', now).run();
  await db.prepare('INSERT INTO cabinet_memberships(cabinet_id,user_id,joined_at) VALUES(?,?,?)').bind('legacy', 'member', now).run();
  const call = (p, user, method = 'POST', body, token, origin) => mf.dispatchFetch('http://localhost' + p, { method, headers: { ...(user ? { cookie: 'cabinlink_session=' + user } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { 'x-cabinet-token': token } : {}), ...(origin ? { origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await call('/legacy')).status, 401);
  for (const user of ['member', 'stranger']) assert.equal((await call('/legacy', user)).status, 403);
  assert.equal((await call('/legacy', 'owner', 'POST', undefined, undefined, 'https://foreign.test')).status, 403);
  let response = await call('/legacy', 'owner'); assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const recovered = await response.json();
  assert.deepEqual(await (await call('/legacy', 'owner')).json(), recovered);
  assert.deepEqual(await (await call('/legacy', 'admin')).json(), recovered);
  for (const [url, role] of [[recovered.adminUrl, 'admin'], [recovered.shareUrl, 'share'], ['http://localhost/manage/' + oldAdmin, 'admin'], ['http://localhost/c/' + oldShare, 'share']]) {
    assert.equal((await (await call('/resolve/' + new URL(url).pathname.split('/').pop(), undefined, 'GET')).json()).role, role);
  }
  response = await call('/create', 'owner', 'POST', { name: '新智能柜' }); assert.equal(response.status, 201);
  const created = await response.json();
  const fetched = await (await call('/' + created.cabinet.id, 'owner')).json();
  assert.equal(fetched.adminUrl, created.adminUrl); assert.equal(fetched.shareUrl, created.shareUrl);
  response = await call('/settings', undefined, 'GET'); assert.equal(response.status, 200); assert.equal((await response.json()).canManage, false);
  const brand = { desktopTitle: '电脑标题', mobileTitle: '手机标题', logoUrl: '' };
  assert.equal((await call('/settings', 'owner', 'PUT', brand)).status, 403);
  assert.equal((await call('/settings', 'admin', 'PUT', brand, undefined, 'https://foreign.test')).status, 403);
  assert.equal((await call('/settings', 'admin', 'PUT', { ...brand, logoUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('/settings', 'admin', 'PUT', { ...brand, mobileTitle: '' })).status, 400);
  assert.equal((await call('/settings', 'admin', 'PUT', brand)).status, 200);
  const banner={heroTitle:'把美好，收进同一个柜子。',heroDescription:'整理照片、收藏文件，用一个链接连接彼此。',heroBackground:''};
  assert.deepEqual(await (await call('/settings', undefined, 'GET')).json(), { ...brand,...banner, canManage: false });
  assert.equal((await call('/settings','admin','PUT',{...brand,...banner,heroTitle:'我的空间',heroDescription:'自定义说明'})).status,200);
  assert.equal((await (await call('/settings',undefined,'GET')).json()).heroTitle,'我的空间');
  assert.equal((await call('/settings','admin','PUT',{...brand,...banner,heroBackground:'javascript:bad'})).status,400);
  await db.prepare('UPDATE cabinets SET closed_at=? WHERE id=?').bind(now, 'legacy').run();
  assert.equal((await call('/legacy', 'admin')).status, 403);
  assert.equal(await (await call('/resolve/' + new URL(recovered.adminUrl).pathname.split('/').pop(), undefined, 'GET')).json(), null);
  console.log('PASS: migrations; link permissions and origin checks; stable recovery; old and new link access; system administrator access; closed cabinet denial; public branding; settings permission, validation and persistence.');
} finally { if (mf) await mf.dispose(); await rm(scratch, { recursive: true, force: true }); }
