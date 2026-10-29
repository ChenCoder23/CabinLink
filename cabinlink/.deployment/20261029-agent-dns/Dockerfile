FROM cabinlink:release-20261029-runtime-recovery
COPY agent-network-dns-fallback.js /app/dist/server/_next/static/agent-network-dns-fallback.js
COPY patch-agent-dns.mjs /tmp/patch-agent-dns.mjs
COPY run-worker.mjs outbound-fetch.mjs patch-wrangler-outbound.mjs /app/scripts/
RUN node /tmp/patch-agent-dns.mjs && node /app/scripts/patch-wrangler-outbound.mjs
LABEL org.opencontainers.image.revision="agent-dns-fallback-20261029"
