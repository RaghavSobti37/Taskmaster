/**
 * Proxies Clerk Frontend API at /__clerk/* (Vercel rewrites tsccoreknot.com → Render).
 * @see https://clerk.com/docs/deployments/overview#proxy-url
 */

const express = require('express');

// ponytail: .clerk.services TLS fails on Render/Node — use .clerk.dev (Clerk proxy docs)
const CLERK_FAPI = String(process.env.CLERK_FAPI_UPSTREAM || '')
  .trim()
  .replace(/\/$/, '') || 'https://frontend-api.clerk.dev';
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

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

/**
 * Clerk Dashboard registers one Frontend API proxy URL (primary app host).
 * Browser may hit auth/landing satellites, but Clerk-Proxy-Url must stay the
 * registered URL or FAPI returns 400 host_invalid (satellite domains = paid plan).
 */
const buildProxyPublicUrl = () => String(
  process.env.CLERK_PROXY_PUBLIC_URL || DEFAULT_PROXY_URL,
).trim();

const buildTargetUrl = (req) => {
  const suffix = String(req.originalUrl || req.url || '').replace(/^\/__clerk\/?/, '/');
  const base = CLERK_FAPI.startsWith('http') ? CLERK_FAPI : `https://${CLERK_FAPI}`;
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 4;

/** Follow Clerk version-pin redirects server-side so browsers get JS body, not 307 to app host. */
const fetchClerkUpstream = async (startUrl, init) => {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const upstream = await fetch(url, init);
    if (!REDIRECT_STATUSES.has(upstream.status)) {
      return upstream;
    }
    const location = upstream.headers.get('location');
    if (!location || hop === MAX_REDIRECTS) {
      return upstream;
    }
    url = new URL(location, url).href;
  }
  return fetch(startUrl, init);
};

const proxyHandler = async (req, res) => {
  const secret = String(process.env.CLERK_SECRET_KEY || '').trim();
  if (!secret) {
    res.status(503).json({ error: 'Clerk proxy not configured' });
    return;
  }

  const targetUrl = buildTargetUrl(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || hopByHop.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else {
      headers.set(key, value);
    }
  }
  headers.set('Clerk-Proxy-Url', buildProxyPublicUrl());
  headers.set('Clerk-Secret-Key', secret);
  headers.set('X-Forwarded-For', clientIp(req));

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(25_000),
  };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (req.rawBody) {
      init.body = req.rawBody;
    } else if (req.body != null) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
  }

  let upstream;
  try {
    upstream = await fetchClerkUpstream(targetUrl, init);
  } catch (err) {
    const detail = err?.cause?.message || err.message;
    res.status(502).json({ error: 'Clerk upstream unreachable', detail });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHop.has(lower) || lower === 'location') return;
    res.setHeader(key, value);
  });

  const body = await upstream.arrayBuffer();
  res.send(Buffer.from(body));
};

const router = express.Router();
router.all(/.*/, proxyHandler);

module.exports = router;
module.exports.buildTargetUrl = buildTargetUrl;
module.exports.buildProxyPublicUrl = buildProxyPublicUrl;
module.exports.DEFAULT_PROXY_URL = DEFAULT_PROXY_URL;
