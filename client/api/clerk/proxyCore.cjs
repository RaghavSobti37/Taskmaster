/**
 * Shared Clerk FAPI proxy (Vercel serverless + tests).
 * @see https://clerk.com/docs/deployments/overview#proxy-url
 */

const DEFAULT_PROXY_URL = 'https://tsccoreknot.com/__clerk';
const DEFAULT_FAPI = 'https://frontend-api.clerk.services';

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

const resolveFapiBase = () => {
  const explicit = String(process.env.CLERK_FAPI_UPSTREAM || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const host = String(process.env.CLERK_FRONTEND_API || '').trim().replace(/^https?:\/\//, '');
  if (host) return `https://${host}`;
  return DEFAULT_FAPI;
};

const buildTargetUrl = (pathSuffix) => {
  const base = resolveFapiBase();
  const suffix = String(pathSuffix || '').replace(/^\//, '');
  return suffix ? `${base}/${suffix}` : base;
};

const clientIp = (headers = {}) => {
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return '127.0.0.1';
};

async function proxyClerkRequest({ method, pathSuffix, headers = {}, body }) {
  const secret = String(process.env.CLERK_SECRET_KEY || '').trim();
  if (!secret) {
    return { status: 503, headers: { 'content-type': 'application/json' }, body: '{"error":"Clerk proxy not configured"}' };
  }

  const targetUrl = buildTargetUrl(pathSuffix);
  const outHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value == null || hopByHop.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => outHeaders.append(key, entry));
    } else {
      outHeaders.set(key, value);
    }
  }
  outHeaders.set('Clerk-Proxy-Url', String(process.env.CLERK_PROXY_PUBLIC_URL || DEFAULT_PROXY_URL).trim());
  outHeaders.set('Clerk-Secret-Key', secret);
  outHeaders.set('X-Forwarded-For', clientIp(headers));

  const init = {
    method: method || 'GET',
    headers: outHeaders,
    redirect: 'manual',
    signal: AbortSignal.timeout(25_000),
  };
  if (body != null && init.method !== 'GET' && init.method !== 'HEAD' && init.method !== 'OPTIONS') {
    init.body = body;
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    const detail = err?.cause?.message || err.message;
    return {
      status: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Clerk upstream unreachable', detail }),
    };
  }

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  return { status: upstream.status, headers: responseHeaders, body: buf };
}

module.exports = {
  DEFAULT_PROXY_URL,
  DEFAULT_FAPI,
  buildTargetUrl,
  proxyClerkRequest,
  resolveFapiBase,
};
