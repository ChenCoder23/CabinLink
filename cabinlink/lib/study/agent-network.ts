const DNS_RESOLVERS = [
  'https://dns.alidns.com/resolve',
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve',
];
type DNSAnswer = { type: number; data: string };
type DNSResult = { Status: number; Answer?: DNSAnswer[] };

export function privateAddress(address: string) {
  if (address.includes(':')) return !/^(2|3)[0-9a-f]{3}:/i.test(address);
  const p = address.split('.').map(Number);
  return p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)
    || [0, 10, 127].includes(p[0]) || p[0] >= 224
    || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
    || (p[0] === 192 && [168, 0].includes(p[1])) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
    || (p[0] === 198 && [18, 19].includes(p[1]));
}

export async function checkDNS(base: string, fetcher: typeof fetch = fetch) {
  const host = new URL(base).hostname;
  for (const resolver of DNS_RESOLVERS) {
    let results: DNSResult[];
    try {
      // Check both address families. A transport failure may use another trusted
      // resolver; a private answer must be rejected, never retried elsewhere.
      results = await Promise.all(['A', 'AAAA'].map(async type => {
        const response = await fetcher(`${resolver}?name=${encodeURIComponent(host)}&type=${type}`, {
          headers: { accept: 'application/dns-json' },
          redirect: 'manual',
          signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw Error('DNS resolver unavailable');
        }
        const result = await response.json() as DNSResult;
        if (typeof result.Status !== 'number' || (result.Answer !== undefined && !Array.isArray(result.Answer))) {
          throw Error('Invalid DNS response');
        }
        return result;
      }));
    } catch (error) {
      console.warn('[agent-dns] resolver unavailable', new URL(resolver).hostname,
        error instanceof Error ? error.message : 'DNS transport failure');
      continue;
    }
    const addresses = results.flatMap(result => result.Answer || []).filter(answer => [1, 28].includes(answer.type));
    if (addresses.some(answer => typeof answer.data !== 'string' || privateAddress(answer.data))) {
      throw Error('AI域名必须解析为公开网络地址');
    }
    if (results.some(result => result.Status === 3)) throw Error('AI域名不存在，请检查Base URL');
    if (results.some(result => result.Status !== 0)) continue;
    if (!addresses.length) throw Error('AI域名没有可用的公网地址，请检查Base URL');
    return;
  }
  throw Error('AI域名校验失败：DNS解析服务暂不可达，请稍后重试；尚未调用AI接口');
}
