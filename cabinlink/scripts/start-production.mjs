import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { schedulerSecret, startScheduler } from './word-scheduler.mjs';
import { healthPolicy, processTreeRssMiB, probeService } from './service-health.mjs';

process.env.WORD_SCHEDULER_SECRET = schedulerSecret;
process.env.WRANGLER_WRITE_LOGS = 'false';
process.env.WRANGLER_SEND_METRICS = 'false';
mkdirSync('/data/secrets', { recursive: true, mode: 0o700 });
const agentKey = '/data/secrets/study-agent.key';
if (!existsSync(agentKey)) writeFileSync(agentKey, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
process.env.STUDY_AGENT_ENCRYPTION_KEY = readFileSync(agentKey, 'utf8').trim();
const config = JSON.parse(readFileSync('wrangler.json', 'utf8'));
config.secrets = { required: [...new Set([...(config.secrets?.required || []), 'WORD_SCHEDULER_SECRET', 'STUDY_AGENT_ENCRYPTION_KEY'])] };
writeFileSync('wrangler.json', JSON.stringify(config));

const child = spawn(process.execPath, [fileURLToPath(new URL('./run-worker.mjs', import.meta.url))], {
  stdio: 'inherit', detached: process.platform !== 'win32',
});
const scheduler = startScheduler();
let stopping = false, checking = false, policy = { failures: 0, highMemory: 0 };
let ready = false, samples = 0;
const started = Date.now();
const timers = [];
const graceMs = Number(process.env.SERVICE_STARTUP_GRACE_MS || 120000);
const checkMs = Number(process.env.SERVICE_HEALTH_INTERVAL_MS || 15000);
const timeoutMs = Number(process.env.SERVICE_HEALTH_TIMEOUT_MS || 5000);
const memoryLimitMiB = Number(process.env.SERVICE_MEMORY_LIMIT_MIB || 850);

function signalChild(signal) {
  if (!child.pid) return;
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') console.error('[supervisor] signal failed:', error.code); }
}
function stop(code, reason) {
  if (stopping) return;
  stopping = true;
  clearInterval(scheduler);
  for (const timer of timers) clearInterval(timer);
  console.error(`[supervisor] stopping: ${reason}; exit=${code}`);
  signalChild('SIGTERM');
  // Exit PID 1 on service loss even if Wrangler does not propagate a crash.
  setTimeout(() => { signalChild('SIGKILL'); process.exit(code); }, 12000);
  child.once('exit', () => { signalChild('SIGKILL'); process.exit(code); });
}
child.on('error', () => stop(1, 'runtime-spawn-failed'));
child.on('exit', (code, signal) => {
  if (!stopping) stop(1, `runtime-exited code=${code} signal=${signal}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(0, signal));

async function check() {
  if (checking || stopping) return;
  checking = true;
  try {
    const healthy = await probeService('http://127.0.0.1:80/api/site-settings', timeoutMs);
    const rssMiB = processTreeRssMiB();
    if (healthy) ready = true;
    if (!ready && Date.now() - started < graceMs) return;
    policy = healthPolicy(policy, { healthy, rssMiB, memoryLimitMiB });
    if (++samples % 20 === 1 || !healthy || policy.highMemory) {
      console.log(`[supervisor] health=${healthy} rssMiB=${rssMiB} failures=${policy.failures} highMemory=${policy.highMemory}`);
    }
    if (policy.reason) stop(1, policy.reason);
  } catch (error) {
    console.error('[supervisor] health monitor error:', error.code || error.name);
    stop(1, 'health-monitor-failed');
  } finally { checking = false; }
}
timers.push(setInterval(check, checkMs));
void check();
