const express = require('express');
const { protect } = require('../middleware/authMiddleware');

function resolveAutoMailerApiBase() {
  const raw = String(process.env.AUTO_MAILER_API_URL || '').trim().replace(/\/$/, '');
  if (!raw) {
    const err = new Error('AUTO_MAILER_API_URL is not configured');
    err.code = 'AUTO_MAILER_API_URL_MISSING';
    throw err;
  }
  // Frontend host has no /api/mail/stats — reject Vercel UI URLs.
  if (/vercel\.app$/i.test(raw) || /auto-mailer-blue/i.test(raw)) {
    const err = new Error('AUTO_MAILER_API_URL must be the Auto-Mailer API origin, not the Vercel UI');
    err.code = 'AUTO_MAILER_API_URL_INVALID';
    throw err;
  }
  return raw;
}

function normalizeMailStatsPayload(raw = {}) {
  const totalClicked = Number(raw.totalClicked ?? raw.totalClicks ?? 0) || 0;
  return {
    totalCampaigns: Number(raw.totalCampaigns ?? 0) || 0,
    totalSent: Number(raw.totalSent ?? 0) || 0,
    totalOpened: Number(raw.totalOpened ?? 0) || 0,
    totalClicked,
    totalClicks: totalClicked,
    totalBounced: Number(raw.totalBounced ?? 0) || 0,
    totalUnsubscribed: Number(raw.totalUnsubscribed ?? 0) || 0,
    timeframe: raw.timeframe || null,
    source: 'auto-mailer',
  };
}

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const base = resolveAutoMailerApiBase();
    const url = new URL('/api/mail/stats', base);
    if (req.query.timeframe) url.searchParams.set('timeframe', String(req.query.timeframe));

    const upstream = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(502).json({
        error: 'Auto-Mailer stats unavailable',
        status: upstream.status,
        detail: text.slice(0, 200),
      });
    }

    const raw = await upstream.json();
    res.set('Cache-Control', 'private, max-age=60');
    return res.json(normalizeMailStatsPayload(raw));
  } catch (err) {
    if (err?.code === 'AUTO_MAILER_API_URL_MISSING' || err?.code === 'AUTO_MAILER_API_URL_INVALID') {
      return res.status(503).json({ error: err.message });
    }
    return res.status(502).json({
      error: 'Failed to load campaign metrics from Auto-Mailer',
      detail: err.message,
    });
  }
});

module.exports = router;
module.exports.resolveAutoMailerApiBase = resolveAutoMailerApiBase;
module.exports.normalizeMailStatsPayload = normalizeMailStatsPayload;
