import { probeService } from './service-health.mjs';
process.exit(await probeService('http://127.0.0.1:80/api/site-settings') ? 0 : 1);
