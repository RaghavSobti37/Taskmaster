const express = require('express');

const PRODUCTION_AUTO_MAILER_URL = 'https://auto-mailer-blue.vercel.app';

function autoMailerOrigin() {
  return String(process.env.AUTO_MAILER_URL || PRODUCTION_AUTO_MAILER_URL).trim().replace(/\/$/, '');
}

function autoMailerPathForRequest(req) {
  const baseUrl = req.baseUrl || '';
  const path = req.path || '';
  if (baseUrl.includes('/campaigns')) {
    const idMatch = path.match(/^\/([^/]+)/);
    if (idMatch && idMatch[1] !== 'upload-attachment') return `/campaigns/${encodeURIComponent(idMatch[1])}`;
    return '/campaigns';
  }
  if (baseUrl.includes('/newsletter')) {
    if (/\/send\b/.test(path)) return '/campaigns/new';
    return '/campaigns';
  }
  if (baseUrl.includes('/track')) return '/analytics';
  if (baseUrl.includes('/data-hub')) return '/audience';
  return '';
}

function autoMailerUrlForRequest(req) {
  return `${autoMailerOrigin()}${autoMailerPathForRequest(req)}`;
}

function movedToAutoMailer(req, res) {
  const url = autoMailerUrlForRequest(req);
  const accept = String(req.get('accept') || '').toLowerCase();
  if (req.method === 'GET' && accept.includes('text/html')) {
    return res.redirect(308, url);
  }
  return res.status(410).json({
    error: 'Moved to Auto-Mailer',
    service: 'auto-mailer',
    url,
  });
}

const router = express.Router();
router.use(movedToAutoMailer);

module.exports = router;
module.exports.autoMailerOrigin = autoMailerOrigin;
module.exports.autoMailerPathForRequest = autoMailerPathForRequest;
module.exports.autoMailerUrlForRequest = autoMailerUrlForRequest;
