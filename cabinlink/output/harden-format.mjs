import fs from 'node:fs';
import ts from 'typescript';
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('app/api/personal/route.ts',s=>'import {validImage} from "@/lib/image-validation";\n'+s.replace('typeof body.avatar!=="string"||body.avatar.length>2_800_000||(body.avatar&&!/^data:image\\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.avatar))','!validImage(body.avatar)'));
edit('app/api/workbench/route.ts',s=>'import {validImage} from "@/lib/image-validation";\n'+s.replace('typeof b.poster!==\'string\'||b.poster.length>2_800_000||(b.poster&&!/^data:image\\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.poster))','!validImage(b.poster)'));
edit('app/api/uploads/route.ts',s=>s.replace('authorizeCabinet, sessionUser','authorizeCabinet, sessionUser, sameOrigin').replace('  try {','  if(!sameOrigin(request))return jsonError("请求来源无效",403);\n  try {'));
const paths=['app/api/personal/route.ts','app/api/workbench/route.ts','app/api/admin/word-schedules/route.ts','app/api/internal/word-scheduler/route.ts','app/workbench/page.tsx','components/theme-control.tsx','components/personal-settings.tsx','components/word-schedule-admin.tsx','lib/personal-server.ts','lib/workbench-server.ts','lib/word-scheduler.ts','lib/image-validation.ts','app/api/uploads/[id]/complete/route.ts'];
for(const p of paths){const source=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);fs.writeFileSync(p,ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(source));}
