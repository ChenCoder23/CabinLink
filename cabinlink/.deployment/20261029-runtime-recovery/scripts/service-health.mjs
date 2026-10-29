import { readdirSync, readFileSync } from 'node:fs';

export function healthPolicy(previous, { healthy, rssMiB, memoryLimitMiB = 850, failureLimit = 3 }) {
  const failures = healthy ? 0 : previous.failures + 1;
  const highMemory = rssMiB >= memoryLimitMiB ? previous.highMemory + 1 : 0;
  return {
    failures,
    highMemory,
    reason: failures >= failureLimit ? 'http-health-failed'
      : highMemory >= 2 ? 'memory-budget-exceeded' : '',
  };
}

// Includes workerd and all descendants, rather than only the Node.js heap.
export function processTreeRssMiB(rootPid = process.pid, procRoot = '/proc') {
  const processes = [];
  for (const pid of readdirSync(procRoot).filter(name => /^\d+$/.test(name))) {
    try {
      const status = readFileSync(`${procRoot}/${pid}/status`, 'utf8');
      processes.push({ pid: Number(pid), parent: Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),
        rss: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) });
    } catch { /* Processes can exit between listing and reading /proc. */ }
  }
  const descendants = new Set([rootPid]);
  let changed;
  do {
    changed = false;
    for (const p of processes) if (descendants.has(p.parent) && !descendants.has(p.pid)) {
      descendants.add(p.pid); changed = true;
    }
  } while (changed);
  return Math.ceil(processes.filter(p => descendants.has(p.pid)).reduce((sum, p) => sum + p.rss, 0) / 1024);
}

export async function probeService(url, timeoutMs = 5000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      await response.body?.cancel();
      return false;
    }
    const data = await response.json();
    return typeof data.desktopTitle === 'string' && data.desktopTitle.length > 0;
  } catch { return false; }
}
