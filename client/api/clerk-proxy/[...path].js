/**
 * Vercel serverless proxy for Clerk Frontend API (taskmaster / tsccoreknot.com).
 * @see https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi
 */
/* global Buffer, module */

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

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (!chunks.length) return undefined;
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    res.status(503).json({ error: 'Clerk proxy not configured' });
    return;
  }

  const pathParts = req.query.path;
  const path = Array.isArray(pathParts) ? pathParts.join('/') : String(pathParts || '');
  const queryIndex = req.url?.indexOf('?') ?? -1;
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
  const targetUrl = `${CLERK_FAPI}/${path}${query}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (hopByHop.has(lower)) continue;
    if (value === undefined) continue;
    headers[key] = value;
  }
  headers['Clerk-Proxy-Url'] = process.env.CLERK_PROXY_PUBLIC_URL || DEFAULT_PROXY_URL;
  headers['Clerk-Secret-Key'] = secret;
  headers['X-Forwarded-For'] = clientIp(req);

  try {
    const body = await readBody(req);
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (hopByHop.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: 'Clerk proxy upstream failed', detail: err.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
