# Runtime recovery (2026-10-29)

The 2026-10-22 10:34:26 Beijing incident was a workerd V8 heap exhaustion,
not a host kernel OOM. The final GC retained about 1,250 MiB. Wrangler stayed
alive after its internal HTTP runtime failed, so Docker's `unless-stopped`
policy never restarted the container. All subsequent scheduler calls failed.

The deployed Wrangler 4.92.0 enables `Network.enable` without a DevTools
connection, appends messages to `InspectorProxyWorker.runtimeMessageBuffer`,
and only drains the buffer when DevTools is connected. The incident's debug
file was 298 MiB and contained 259,127 incoming messages, including 57,404
`Network.dataReceived` events. This matches Cloudflare's confirmed defect:
[workers-sdk #14191](https://github.com/cloudflare/workers-sdk/issues/14191)
and [fix #14243](https://github.com/cloudflare/workers-sdk/pull/14243).

## Controls

- `run-worker.mjs` uses Wrangler's programmatic API with `dev.inspector: false`.
  `--inspector-port=0` does not disable the CLI inspector. The production runner
  verifies that the resolved inspector URL is absent. Source watching, live
  reload, telemetry, and Wrangler debug files are disabled.
- `start-production.mjs` probes `/api/site-settings` every 15 seconds with a
  5-second timeout. This endpoint reads D1; a successful JSON response with a
  title is required. Startup has a 120-second grace period, ending early after
  the first successful probe. Three consecutive failures stop the process group
  and exit PID 1 with code 1, allowing Docker to restart the service.
- The supervisor samples RSS for itself and all descendants, including workerd.
  Two samples at or above 850 MiB trigger the same recovery. RSS may double-count
  shared pages, so this is a conservative operational budget, not a heap profile.
- Shutdown sends SIGTERM, then SIGKILL after at most 12 seconds. The supervisor
  logs the recovery reason and periodic memory/health samples without credentials.
- Docker HEALTHCHECK exposes readiness; Docker restart is driven by supervisor
  exit, because an unhealthy state alone does not restart a standalone container.
- The deployed container has a 1,200 MiB memory limit, 1,500 MiB combined memory
  and swap limit, and rotated Docker logs (10 MiB × 3).

Run `node scripts/test-service-health.mjs` to check health policy, timeouts,
response validation, RSS process traversal, and disabled inspector settings.
Candidate validation also exercises authenticated study reads and injects a
stopped workerd to verify actual automatic container recovery. A low candidate
memory budget exercises memory recovery without exhausting host RAM.

Observed on the same 212,793-byte study response with concurrency 3: the old
runtime grew from 516.6 MiB to 962.4 MiB RSS after 300 reads (26.3 seconds).
The repaired runtime ended three successive 300-read batches at 618.7,
724.2 and 737.9 MiB RSS (14.6, 14.8 and 14.0 seconds). Both failure-injection
checks passed. These are short reproduction checks, not a long-duration soak.

## Deployment and rollback

Build future images with the root Dockerfile; it includes every runtime helper
and the Docker health check. Preserve `/data`, all runtime secrets, published
ports and environment values. Use `--restart unless-stopped --memory 1200m
--memory-swap 1500m --log-opt max-size=10m --log-opt max-file=3`.

The incident repair image extends the currently deployed application image and
only replaces runtime scripts. It does not build or publish local business UI
changes. Candidate data is an isolated copy with SQLite's online backup API.

Deployed image: `cabinlink:release-20261029-runtime-recovery`. Docker reports
`healthy`, and protected database table hashes match before/after replacement.
Full backup: `/opt/cabinlink/backups/data-before-runtime-recovery-20261029T012126Z.tar.gz`.
Retained predecessor: `cabinlink-prev-20261029-runtime-recovery`.
Candidate data and its temporary session were removed after validation.

Runtime defaults can be overridden through `SERVICE_HEALTH_INTERVAL_MS`,
`SERVICE_HEALTH_TIMEOUT_MS`, `SERVICE_STARTUP_GRACE_MS`, and
`SERVICE_MEMORY_LIMIT_MIB`. Accelerated or low-budget fault-test values must
never be copied from the candidate into the production environment.

Inspect `docker logs cabinlink` for `[supervisor]` samples and restart reasons;
`docker inspect cabinlink` reports restart count and health. If rolling back,
stop the repaired container before starting its retained predecessor against
the same volume. The predecessor has the original inspector leak and should
only be used to recover from a regression.

Disabling the identified source and passing short load/fault tests cannot prove
that every future memory leak is impossible. The RSS guard and HTTP recovery
bound the effect of a different failure and retain diagnostic samples.
