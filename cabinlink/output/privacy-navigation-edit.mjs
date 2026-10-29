import fs from 'node:fs';
const file='lib/workbench-server.ts',source=fs.readFileSync(file,'utf8');
const intro=source.match(/const introduction=(.*);\n/)[1];
const tasks=source.match(/const tasks=(.*);\n/)[1];
const seed=Function(`return {introduction:${intro},tasks:${tasks}}`)();
fs.writeFileSync('.secrets/workbench-seed.json',JSON.stringify(seed,null,2));
fs.writeFileSync(file,`import { requireStorage } from "@/lib/cabinet-server";
// Private initial data is seeded by the deployment operator, never shipped in client or source assets.
export async function initializeWorkbench(userId:string){const {db}=requireStorage();await db.prepare("INSERT OR IGNORE INTO workbench_profile(user_id,introduction) VALUES(?,'')").bind(userId).run();}
`);
for(const p of ['app/page.tsx','app/my/page.tsx','app/settings/page.tsx','components/cabinet-workspace.tsx']){let s=fs.readFileSync(p,'utf8').replace('import Link from "next/link";','').replace(/<Link\b/g,'<a').replace(/<\/Link>/g,'</a>');s=s.replace('import { useRouter } from "next/navigation";','').replace('  const router = useRouter();','').replace('router.push(target.pathname);','window.location.href=target.pathname;');s='/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids Vinext RSC link errors. */\n'+s;fs.writeFileSync(p,s);}
