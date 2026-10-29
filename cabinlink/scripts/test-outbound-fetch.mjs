import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { outboundFetch } from './outbound-fetch.mjs';
import { patchWranglerOutbound } from './patch-wrangler-outbound.mjs';
import { readFileSync } from 'node:fs';
const original = readFileSync('node_modules/wrangler/wrangler-dist/cli.js', 'utf8');
const patched = patchWranglerOutbound(original);
assert.ok(patched.includes('outboundService: input.dev?.outboundService'));
assert.ok(patched.includes('options.workers[0].outboundService = data.config.dev.outboundService'));
assert.equal(patchWranglerOutbound(patched), patched);
assert.throws(() => patchWranglerOutbound('changed runtime'), /no longer matches/);
const server = createServer(async (request, response) => {
  if (request.url === '/hang') return;
  if (request.url === '/redirect') {
    response.writeHead(302, { location: '/private' }); response.end(); return;
  }
  if (request.url === '/gzip') {
    const bytes = gzipSync('verified response');
    response.writeHead(200, { 'content-encoding': 'gzip', 'content-length': String(bytes.length) });
    response.end(bytes); return;
  }
  let body = '';
  for await (const chunk of request) body += chunk;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ body, auth: request.headers.authorization, method: request.method }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const result = await outboundFetch(new Request(base + '/echo', { method: 'POST', headers: { authorization: 'Bearer test-only' }, body: 'request data' }));
  assert.deepEqual(await result.json(), { body: 'request data', auth: 'Bearer test-only', method: 'POST' });
  const compressed = await outboundFetch(new Request(base + '/gzip'));
  assert.equal(await compressed.text(), 'verified response');
  assert.equal(compressed.headers.get('content-encoding'), null);
  assert.equal(compressed.headers.get('content-length'), null);
  assert.equal((await outboundFetch(new Request(base + '/redirect'))).status, 302);
  await assert.rejects(outboundFetch(new Request(base + '/hang', { signal: AbortSignal.timeout(100) })));
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
console.log('PASS outbound streaming, authorization, decompression headers, redirect refusal and request cancellation');
