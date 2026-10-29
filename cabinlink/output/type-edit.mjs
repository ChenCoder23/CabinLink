import fs from 'node:fs';
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('app/api/workbench/route.ts',s=>s.replace('const b=await r.json();',"const b=await r.json() as {action:string;id:string;introduction:string;kind:string;title:string;description:string;criteria:string;due_date:string;poster:string;progress:number;sort_order:number;focus:boolean};"));
edit('app/api/admin/word-schedules/route.ts',s=>s.replace('const b=await r.json();',"const b=await r.json() as {action:string;id:string;status:string;library_id:string;start_date:string;publish_time:string;daily_count:number};"));
edit('app/workbench/page.tsx',s=>s.replace('const b=await r.json();','const b=await r.json() as {error:string;tasks:Task[];profile:{introduction:string}};'));
edit('components/personal-settings.tsx',s=>s.replace('r.ok?r.json():null','r.ok?r.json() as Promise<{used:number;reserved:number;limit:number|null}>:null').replace('const b=await r.json();','const b=await r.json() as {error:string;relogin?:boolean};'));
edit('components/word-schedule-admin.tsx',s=>s.replace('setCategories((await c.json()).categories)','setCategories((await c.json() as {categories:{id:string;name:string}[]}).categories)').replace('const b=await r.json();','const b=await r.json() as {error:string;days:number;total:number;last_date:string;sample:{english:string}[]};'));
edit('Dockerfile',s=>s.replace('COPY docker/start.sh ./start.sh','COPY docker/start.sh ./start.sh\nCOPY scripts/start-production.mjs scripts/word-scheduler.mjs ./scripts/'));
// Old clients may update only branding; preserve the existing banner in this case.
edit('app/api/site-settings/route.ts',s=>s.replace('if (typeof body.heroTitle',`const existing=await readBrand();body.heroTitle ??= existing.heroTitle;body.heroDescription ??= existing.heroDescription;body.heroBackground ??= existing.heroBackground;\n    if (typeof body.heroTitle`));
