import {spawn} from 'node:child_process';
import {schedulerSecret,startScheduler} from './word-scheduler.mjs';
const child=spawn(process.execPath,['../../node_modules/wrangler/bin/wrangler.js','dev','--local','--config','wrangler.json','--persist-to','/data','--ip','0.0.0.0','--port','80','--binding',`WORD_SCHEDULER_SECRET=${schedulerSecret}`],{stdio:'inherit'});
const interval=startScheduler();for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>{clearInterval(interval);process.exit(code??1);});
