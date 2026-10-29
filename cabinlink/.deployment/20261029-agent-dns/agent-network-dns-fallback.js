// lib/study/agent-network.ts
var DNS_RESOLVERS = [
  "https://dns.alidns.com/resolve",
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve"
];
function privateAddress(address) {
  if (address.includes(":")) return !/^(2|3)[0-9a-f]{3}:/i.test(address);
  const p = address.split(".").map(Number);
  return p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255) || [0, 10, 127].includes(p[0]) || p[0] >= 224 || p[0] === 169 && p[1] === 254 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 || p[0] === 192 && [168, 0].includes(p[1]) || p[0] === 100 && p[1] >= 64 && p[1] <= 127 || p[0] === 198 && [18, 19].includes(p[1]);
}
async function checkDNS(base, fetcher = fetch) {
  const host = new URL(base).hostname;
  for (const resolver of DNS_RESOLVERS) {
    let results;
    try {
      results = await Promise.all(["A", "AAAA"].map(async (type) => {
        const response = await fetcher(`${resolver}?name=${encodeURIComponent(host)}&type=${type}`, {
          headers: { accept: "application/dns-json" },
          redirect: "manual",
          signal: AbortSignal.timeout(3500)
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw Error("DNS resolver unavailable");
        }
        const result = await response.json();
        if (typeof result.Status !== "number" || result.Answer !== void 0 && !Array.isArray(result.Answer)) {
          throw Error("Invalid DNS response");
        }
        return result;
      }));
    } catch (error) {
      console.warn(
        "[agent-dns] resolver unavailable",
        new URL(resolver).hostname,
        error instanceof Error ? error.message : "DNS transport failure"
      );
      continue;
    }
    const addresses = results.flatMap((result) => result.Answer || []).filter((answer) => [1, 28].includes(answer.type));
    if (addresses.some((answer) => typeof answer.data !== "string" || privateAddress(answer.data))) {
      throw Error("AI\u57DF\u540D\u5FC5\u987B\u89E3\u6790\u4E3A\u516C\u5F00\u7F51\u7EDC\u5730\u5740");
    }
    if (results.some((result) => result.Status === 3)) throw Error("AI\u57DF\u540D\u4E0D\u5B58\u5728\uFF0C\u8BF7\u68C0\u67E5Base URL");
    if (results.some((result) => result.Status !== 0)) continue;
    if (!addresses.length) throw Error("AI\u57DF\u540D\u6CA1\u6709\u53EF\u7528\u7684\u516C\u7F51\u5730\u5740\uFF0C\u8BF7\u68C0\u67E5Base URL");
    return;
  }
  throw Error("AI\u57DF\u540D\u6821\u9A8C\u5931\u8D25\uFF1ADNS\u89E3\u6790\u670D\u52A1\u6682\u4E0D\u53EF\u8FBE\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF1B\u5C1A\u672A\u8C03\u7528AI\u63A5\u53E3");
}
export {
  checkDNS,
  privateAddress
};
