# AI connection test repair — 2026-10-29

The saved DeepSeek credential and `deepseek-flash` model were valid: authenticated
`/models` and a minimal Chat Completions request returned HTTP 200 from the host.
The application's connection test failed before calling DeepSeek because its
single DNS-over-HTTPS resolver, `cloudflare-dns.com`, was unreachable from the
deployment network. Google DNS was also unreachable. AliDNS was reachable, but
the pinned workerd runtime rejected its served TLS chain with `unable to get
local issuer certificate`. Node's HTTPS transport successfully verified it.

`agent-network.ts` now uses AliDNS first and tries Cloudflare/Google on transport
or resolver failures, with bounded timeouts. It checks both A and AAAA records,
rejects private addresses, refuses redirects, and reports DNS-stage failures
separately from upstream AI errors. A private address response is rejected
immediately instead of retrying another resolver.

For self-hosted Docker, `run-worker.mjs` configures a streaming outbound service
through Node's normal verified TLS transport. Certificate checks remain enabled;
requests do not follow redirects. Headers describing a compressed upstream body
are removed after Node fetch decompresses it. Tokens stay in memory and are
never logged. This transport also retains request cancellation.

Wrangler 4.92.0 declares `dev.outboundService` in its public types but drops it in
its implementation. `patch-wrangler-outbound.mjs` restores the two missing
pass-throughs, specifically into the user worker's Miniflare options. The patch
is idempotent, checks exact anchors, and refuses a different Wrangler version.
Review and remove it when upgrading Wrangler. The root Dockerfile applies it
for future builds; Cloudflare-hosted builds only need the application DNS change.

Validation: `node scripts/test-agent-network.mjs`,
`node scripts/test-outbound-fetch.mjs`, `node scripts/test-service-health.mjs`,
`node scripts/test-study-planner.mjs`, and `npx tsc --noEmit`.
The isolated candidate passed the real application connection test with the
existing encrypted configuration and reported `connected` with a test timestamp.

The deployment image `cabinlink:release-20261029-agent-dns` extends the previous
runtime repair image. Only the deployed DNS function and outbound transport are
replaced, so unrelated local application changes are not published. Data is
backed up and protected table hashes are checked before and after replacement.
Runtime inspector suppression, health supervision, memory limits and log rotation
remain enabled. The previous container is retained for rollback.
