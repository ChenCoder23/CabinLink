import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {schedulerSecret,startScheduler} from './word-scheduler.mjs';
// Declare this as a Worker secret so Wrangler never prints its value as a variable.
process.env.WORD_SCHEDULER_SECRET=schedulerSecret;
const config=JSON.parse(readFileSync('wrangler.json','utf8'));
config.secrets={required:[...new Set([...(config.secrets?.required||[]),'WORD_SCHEDULER_SECRET'])]};
writeFileSync('wrangler.json',JSON.stringify(config));
const child=spawn(process.execPath,['../../node_modules/wrangler/bin/wrangler.js','dev','--local','--config','wrangler.json','--persist-to','/data','--ip','0.0.0.0','--port','80'],{stdio:'inherit'});
const interval=startScheduler();for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>{clearInterval(interval);process.exit(code??1);});
