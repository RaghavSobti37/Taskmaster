/**
 * Edge middleware: Clerk Frontend API proxy at /__clerk/*
 */

const CLERK_FAPI = 'https://frontend-api.clerk.services';
const DEFAULT_PROXY_URL = 'https://tsccoreknot.com/__clerk';

const hopByHop = new Set([
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

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';
}

export const config = {
  matcher: '/__clerk/:path*',
};

export default async function middleware(request) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Clerk proxy not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const incoming = new URL(request.url);
  const path = incoming.pathname.replace(/^\/__clerk\/?/, '');
  const targetUrl = `${CLERK_FAPI}/${path}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (hopByHop.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.set('Clerk-Proxy-Url', process.env.CLERK_PROXY_PUBLIC_URL || DEFAULT_PROXY_URL);
  headers.set('Clerk-Secret-Key', secret);
  headers.set('X-Forwarded-For', clientIp(request));

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (hopByHop.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
