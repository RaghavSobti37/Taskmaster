/**
 * Same-origin /api proxy for mobile browsers + PWAs.
 * Reads RENDER_API_PROXY_URL at the edge — all HTTP methods, nested paths.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

const resolveApiBase = () =>
  String(process.env.RENDER_API_PROXY_URL || process.env.VITE_API_URL || '')
    .trim()
    .replace(/\/$/, '');

export const config = {
  matcher: '/api/:path*',
  runtime: 'nodejs',
};

export default async function middleware(request) {
  const base = resolveApiBase();
  if (!base) {
    return new Response(
      JSON.stringify({ error: 'API proxy is not configured (RENDER_API_PROXY_URL).' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }

  const incoming = new URL(request.url);
  const target = `${base}${incoming.pathname}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    return await fetch(target, init);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Upstream API unreachable',
        detail: error?.message || 'fetch failed',
      }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }
}
