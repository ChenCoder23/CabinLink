import { build } from 'esbuild';
import assert from 'node:assert/strict';
const bundle = await build({ entryPoints: ['lib/study/agent-network.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { checkDNS } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const answer = (type = 1, data = '1.1.1.1') => Response.json({ Status: 0, Answer: [{ type, data }] });
const calls = [];
await checkDNS('https://api.deepseek.com', async (url, options) => {
  calls.push(url);
  assert.equal(options.redirect, 'manual');
  return url.endsWith('type=A') ? answer() : Response.json({ Status: 0 });
});
assert.equal(calls.length, 2);
assert.ok(calls.every(url => url.startsWith('https://dns.alidns.com/resolve?')));
for (const mode of ['network', 'http', 'invalid-json', 'invalid-shape', 'servfail']) {
  const attempted = [];
  await checkDNS('https://api.deepseek.com', async url => {
    const host = new URL(url).hostname; attempted.push(host);
    if (host === 'dns.alidns.com') {
      if (mode === 'network') throw Error('Network connection lost.');
      if (mode === 'http') return new Response(null, { status: 503 });
      if (mode === 'invalid-json') return new Response('{');
      if (mode === 'invalid-shape') return Response.json({});
      return Response.json({ Status: 2 });
    }
    return answer();
  });
  assert.ok(attempted.includes('cloudflare-dns.com'), mode);
}
for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.18.0.1', 'fc00::1', '::1', '::ffff:127.0.0.1']) {
  const hosts = new Set();
  await assert.rejects(checkDNS('https://api.example.com', async url => {
    hosts.add(new URL(url).hostname);
    return answer(address.includes(':') ? 28 : 1, address);
  }), /公开网络地址/);
  assert.equal(hosts.size, 1, 'Private answers must not fall back');
}
await assert.rejects(checkDNS('https://api.example.com', async () => Response.json({ Status: 3 })), /域名不存在/);
await assert.rejects(checkDNS('https://api.example.com', async () => Response.json({ Status: 0 })), /没有可用/);
await assert.rejects(checkDNS('https://api.example.com', async () => { throw Error('Network connection lost.'); }), /DNS解析服务暂不可达/);
await checkDNS('https://api.example.com', async () => answer(28, '2606:4700:4700::1111'));
console.log('PASS DNS fallback, IPv4/IPv6 rejection, no fallback for private addresses, resolver failures and clear errors');
