/**
 * Proxies Clerk Frontend API at /__clerk/* (Vercel rewrites tsccoreknot.com → Render).
 * @see https://clerk.com/docs/deployments/overview#proxy-url
 */

const express = require('express');

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

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

const buildTargetUrl = (req) => {
  const suffix = String(req.originalUrl || req.url || '').replace(/^\/__clerk\/?/, '/');
  return `${CLERK_FAPI}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
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
  headers.set('Clerk-Proxy-Url', String(process.env.CLERK_PROXY_PUBLIC_URL || DEFAULT_PROXY_URL).trim());
  headers.set('Clerk-Secret-Key', secret);
  headers.set('X-Forwarded-For', clientIp(req));

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
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
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    res.status(502).json({ error: 'Clerk upstream unreachable', detail: err.message });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const body = await upstream.arrayBuffer();
  res.send(Buffer.from(body));
};

const router = express.Router();
router.all(/.*/, proxyHandler);

module.exports = router;
module.exports.buildTargetUrl = buildTargetUrl;
module.exports.DEFAULT_PROXY_URL = DEFAULT_PROXY_URL;
