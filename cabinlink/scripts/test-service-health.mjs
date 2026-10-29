import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { healthPolicy, processTreeRssMiB, probeService } from './service-health.mjs';
import { workerOptions } from './worker-options.mjs';

let state = { failures: 0, highMemory: 0 };
for (let i = 0; i < 2; i++) {
  state = healthPolicy(state, { healthy: false, rssMiB: 300 });
  assert.equal(state.reason, '');
}
assert.equal(healthPolicy(state, { healthy: false, rssMiB: 300 }).reason, 'http-health-failed');
state = healthPolicy(state, { healthy: true, rssMiB: 300 });
assert.equal(state.failures, 0);
state = healthPolicy(state, { healthy: true, rssMiB: 900 });
assert.equal(state.reason, '');
assert.equal(healthPolicy(state, { healthy: true, rssMiB: 900 }).reason, 'memory-budget-exceeded');
assert.equal(healthPolicy(state, { healthy: true, rssMiB: 300 }).highMemory, 0);

const proc = mkdtempSync(join(tmpdir(), 'cabinlink-proc-'));
try {
  // Deliberately list grandchildren before parents; ignore unrelated processes.
  for (const [pid, parent, rss] of [[10, 20, 20480], [20, 30, 10240], [30, 1, 10240], [40, 1, 999999]]) {
    mkdirSync(join(proc, String(pid)));
    writeFileSync(join(proc, String(pid), 'status'), `PPid:\t${parent}\nVmRSS:\t${rss} kB\n`);
  }
  assert.equal(processTreeRssMiB(30, proc), 40);
} finally { rmSync(proc, { recursive: true }); }

const server = createServer((request, response) => {
  if (request.url === '/hang') return;
  response.setHeader('Content-Type', request.url === '/html' ? 'text/html' : 'application/json');
  if (request.url === '/error') response.statusCode = 500;
  response.end(JSON.stringify(request.url === '/wrong' ? { error: 'unavailable' } : { desktopTitle: 'CabinLink' }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  assert.equal(await probeService(base + '/ok'), true);
  for (const path of ['/error', '/wrong', '/html', '/hang']) {
    assert.equal(await probeService(base + path, 100), false, path);
  }
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
assert.equal(await probeService(base + '/ok', 100), false);
const options = workerOptions();
assert.equal(options.dev.inspector, false);
assert.equal(options.dev.watch, false);
assert.equal(options.dev.persist, '/data');
console.log('PASS health failures/reset, memory budget, process-tree RSS, bad responses/timeouts, inspector disabled');
