import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Wrangler 4.92 declares dev.outboundService in its API types but drops the
// option while resolving config and constructing Miniflare. Restore both
// pass-throughs so self-hosted HTTPS can use Node's verified TLS transport.
export function patchWranglerOutbound(source) {
  if (source.includes('/* cabinlink-outbound-service */')) return source;
  const changes = [
    ['registry: input.dev?.registry,\n    multiworkerPrimary:',
      'registry: input.dev?.registry,\n    outboundService: input.dev?.outboundService, /* cabinlink-outbound-service */\n    multiworkerPrimary:'],
    ['options.liveReload = false;\n          if (this.#mf === void 0)',
      'options.liveReload = false;\n          options.workers[0].outboundService = data.config.dev.outboundService;\n          if (this.#mf === void 0)'],
  ];
  for (const [before, after] of changes) {
    if (source.split(before).length !== 2) throw Error('Wrangler outbound compatibility patch no longer matches; review the pinned runtime');
    source = source.replace(before, after);
  }
  return source;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve('wrangler/package.json');
  const info = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (info.version !== '4.92.0') throw Error('Review/remove the outbound compatibility patch when upgrading Wrangler');
  const path = new URL('./wrangler-dist/cli.js', 'file:///' + packagePath.replaceAll('\\', '/').replace(/^\//, ''));
  writeFileSync(path, patchWranglerOutbound(readFileSync(path, 'utf8')));
  console.log('Wrangler 4.92 outbound HTTPS transport hook enabled');
}
