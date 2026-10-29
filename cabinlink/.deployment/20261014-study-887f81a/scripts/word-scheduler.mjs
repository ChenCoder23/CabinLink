// Standalone service: retries on the next minute; durable SQL records prevent duplicates.
import {randomBytes} from 'node:crypto';
export const schedulerSecret=process.env.WORD_SCHEDULER_SECRET||randomBytes(32).toString('hex');
export function startScheduler(){let busy=false;const tick=async()=>{if(busy)return;busy=true;try{const r=await fetch(`${process.env.WORD_SCHEDULER_URL||'http://127.0.0.1:80'}/api/internal/word-scheduler`,{method:'POST',headers:{Authorization:`Bearer ${schedulerSecret}`},signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const result=await r.json();if(result.published)console.log(`Published ${result.published} words`);}catch(e){console.error('Word scheduler retry:',e.message);}finally{busy=false;}};void tick();return setInterval(tick,60000);}
if(process.argv[1]?.endsWith('word-scheduler.mjs')){if(!process.env.WORD_SCHEDULER_SECRET)throw Error('WORD_SCHEDULER_SECRET is required');startScheduler();}
