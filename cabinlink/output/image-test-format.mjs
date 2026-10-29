import fs from 'node:fs';import ts from 'typescript';
let p='scripts/test-personal-upgrade.mjs',s=fs.readFileSync(p,'utf8');s=s.replace("assert.equal((await call(avatarUrl,'alice')).status,200)","await imageOk(avatarUrl,'alice')").replace("assert.equal((await call(posterTask.poster,'owner')).status,200)","await imageOk(posterTask.poster,'owner')").replace("assert.equal((await call(brand.heroBackground)).status,200)","await imageOk(brand.heroBackground)");
s=s.replace("console.log('PASS: large PNG",`r=await call('/uploads','alice','POST',info('c2',4));const actualId=(await r.json()).uploadId;
assert.equal((await mf.dispatchFetch('http://localhost/part/'+actualId,{method:'PUT',headers:{cookie:'cabinlink_session=alice','content-length':'4'},body:new Uint8Array([1,2,3,4])})).status,200);
assert.equal((await call('/complete/'+actualId,'bob','POST')).status,403);assert.equal((await call('/complete/'+actualId,'alice','POST')).status,200);
assert.equal((await db.prepare('SELECT uploader_user_id FROM files WHERE original_name=?').bind('test.bin').first()).uploader_user_id,'alice');
console.log('PASS: valid multipart completion and uploader ownership.');
console.log('PASS: large PNG`);
fs.writeFileSync(p,s);
for(const file of ['lib/image-storage.ts','app/api/images/[kind]/[id]/route.ts','app/api/personal/route.ts','app/api/site-settings/route.ts','app/api/workbench/route.ts']){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);fs.writeFileSync(file,ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(source));}
