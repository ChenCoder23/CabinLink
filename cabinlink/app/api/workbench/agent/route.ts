import { workbenchUser } from '@/lib/personal-server';
import { sameOrigin } from '@/lib/auth-server';
import { saveAgent, testAgent, chat, recognize, publicAgent } from '@/lib/study/agent';
import { applyProposal } from '@/lib/study/store';
const headers={'Cache-Control':'private, no-store'};
export async function GET(r:Request){const u=await workbenchUser(r);if(!u)return new Response(null,{status:404});return Response.json(await publicAgent(u.id),{headers});}
export async function POST(r:Request){if(!sameOrigin(r))return new Response(null,{status:403});const u=await workbenchUser(r);if(!u)return new Response(null,{status:404});try{const raw=await r.text();if(raw.length>3100000)throw Error('请求过大');const b=JSON.parse(raw);let result:unknown={ok:true};if(b.action==='config')await saveAgent(u.id,b,r);else if(b.action==='test')await testAgent(u.id);else if(b.action==='chat')result=await chat(u.id,b.text);else if(b.action==='apply'||b.action==='undo')await applyProposal(u.id,b.id,b.action==='undo');else if(b.action==='recognize')result={text:await recognize(u.id,b.image)};else throw Error('未知操作');return Response.json(result,{headers});}catch(e){return Response.json({error:e instanceof Error?e.message:'AI调用失败，计划已保留'},{status:400,headers});}}
