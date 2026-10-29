import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {schedulerSecret,startScheduler} from './word-scheduler.mjs';
// Declare this as a Worker secret so Wrangler never prints its value as a variable.
process.env.WORD_SCHEDULER_SECRET=schedulerSecret;
mkdirSync('/data/secrets',{recursive:true,mode:0o700});
const agentKey='/data/secrets/study-agent.key';
if(!existsSync(agentKey))writeFileSync(agentKey,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
process.env.STUDY_AGENT_ENCRYPTION_KEY=readFileSync(agentKey,'utf8').trim();
const config=JSON.parse(readFileSync('wrangler.json','utf8'));
config.secrets={required:[...new Set([...(config.secrets?.required||[]),'WORD_SCHEDULER_SECRET','STUDY_AGENT_ENCRYPTION_KEY'])]};
writeFileSync('wrangler.json',JSON.stringify(config));
const child=spawn(process.execPath,['../../node_modules/wrangler/bin/wrangler.js','dev','--local','--config','wrangler.json','--persist-to','/data','--ip','0.0.0.0','--port','80'],{stdio:'inherit'});
const interval=startScheduler();for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>{clearInterval(interval);process.exit(code??1);});
