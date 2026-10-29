import { unstable_startWorker } from 'wrangler';
import { workerOptions } from './worker-options.mjs';
import { outboundFetch } from './outbound-fetch.mjs';

process.env.WRANGLER_WRITE_LOGS = 'false';
process.env.WRANGLER_SEND_METRICS = 'false';
process.env.CLOUDFLARE_CF_FETCH_ENABLED = 'false';

const options = workerOptions();
options.dev.outboundService = outboundFetch;
const worker = await unstable_startWorker(options);
await worker.ready;
if (await worker.inspectorUrl !== undefined) {
  await worker.dispose();
  throw new Error('Production inspector must be disabled');
}
console.log('[runtime] ready; inspector disabled; source watching disabled');
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  try { await worker.dispose(); clearTimeout(deadline); process.exit(0); }
  catch { process.exit(1); }
});
