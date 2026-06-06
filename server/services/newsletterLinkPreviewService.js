const dns = require('dns').promises;
const net = require('net');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

const isPrivateIp = (ip) => {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80')) return true;
  }
  return false;
};

const normalizeUrl = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
};

const assertSafeUrl = async (rawUrl) => {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error('Invalid URL');

  const hostname = url.hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) throw new Error('URL host is not allowed');
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('URL host is not allowed');
  }

  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve URL host');
  }

  for (const entry of addresses) {
    if (isPrivateIp(entry.address)) throw new Error('URL host resolves to a private address');
  }

  return url;
};

const pickMeta = ($, selectors) => {
  for (const selector of selectors) {
    const el = $(selector).first();
    if (!el.length) continue;
    const content = el.attr('content') || el.attr('value') || el.text();
    if (content && String(content).trim()) return String(content).trim();
  }
  return '';
};

const resolveImageUrl = (baseUrl, imageUrl) => {
  if (!imageUrl) return '';
  try {
    return new URL(imageUrl, baseUrl).href;
  } catch {
    return imageUrl;
  }
};

const parseMetadataFromHtml = (html, pageUrl) => {
  const $ = cheerio.load(html);
  const title = pickMeta($, [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
    'title',
  ]);
  const description = pickMeta($, [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);
  const imageUrl = resolveImageUrl(pageUrl, pickMeta($, [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ]));
  const siteName = pickMeta($, [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
  ]);

  return {
    title: title.slice(0, 500),
    description: description.slice(0, 2000),
    imageUrl: imageUrl.slice(0, 2048),
    siteName: siteName.slice(0, 200),
  };
};

const fetchHtml = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'CoreKnotNewsletterBot/1.0 (+https://tsccoreknot.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('Not an HTML page');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_HTML_BYTES) {
      return buffer.subarray(0, MAX_HTML_BYTES).toString('utf8');
    }
    return buffer.toString('utf8');
  } finally {
    clearTimeout(timer);
  }
};

const previewLink = async (rawUrl) => {
  const empty = {
    url: String(rawUrl || '').trim(),
    canonicalUrl: '',
    title: '',
    description: '',
    imageUrl: '',
    siteName: '',
    fetchStatus: 'failed',
  };

  try {
    const url = await assertSafeUrl(rawUrl);
    empty.url = url.href;
    empty.canonicalUrl = url.href;

    const html = await fetchHtml(url);
    const meta = parseMetadataFromHtml(html, url.href);
    return {
      url: url.href,
      canonicalUrl: url.href,
      ...meta,
      fetchStatus: meta.title || meta.description ? 'success' : 'failed',
    };
  } catch (err) {
    logger.warn('[Newsletter] Link preview failed', { url: rawUrl, error: err.message });
    try {
      const url = await assertSafeUrl(rawUrl);
      empty.canonicalUrl = url.href;
      empty.url = url.href;
    } catch {
      /* keep raw url */
    }
    return empty;
  }
};

module.exports = {
  previewLink,
  normalizeUrl,
  assertSafeUrl,
};
