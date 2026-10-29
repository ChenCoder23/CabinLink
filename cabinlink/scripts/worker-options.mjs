export function workerOptions({ config = 'wrangler.json', persist = '/data', port = 80 } = {}) {
  return {
    config,
    sendMetrics: false,
    dev: {
      remote: false,
      persist,
      server: { hostname: '0.0.0.0', port },
      // Wrangler 4.92's CLI always enables InspectorProxyWorker. Its unbounded
      // runtimeMessageBuffer leaks without DevTools (#14191). Port 0 cannot
      // disable it; the programmatic API can disable the inspector entirely.
      inspector: false,
      watch: false,
      liveReload: false,
      logLevel: 'warn',
    },
  };
}
