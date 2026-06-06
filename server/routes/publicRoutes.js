const express = require('express');
const rateLimit = require('express-rate-limit');
const { listPublicMasterclassReviews } = require('../services/masterclassReviewService');

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 120 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

router.get('/masterclass-reviews', publicLimiter, async (req, res) => {
  try {
    const campaign = req.query.campaign;
    const payload = await listPublicMasterclassReviews(campaign);
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(payload);
  } catch (err) {
    console.error('[public] masterclass-reviews error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to load reviews' });
  }
});

module.exports = router;
