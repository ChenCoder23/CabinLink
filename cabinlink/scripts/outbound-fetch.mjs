// Self-hosted workerd 1.20260515's embedded CA bundle does not trust some
// currently served HTTPS chains. Use Node's verified TLS transport; never
// disable certificate verification. Keep requests/responses streaming.
export async function outboundFetch(request) {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    duplex: 'half',
    redirect: 'manual',
    signal: request.signal,
  });
  const headers = new Headers(response.headers);
  // Node fetch decompresses the body. Do not forward stale encoding/length.
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
