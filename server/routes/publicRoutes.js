const express = require('express');
const rateLimit = require('express-rate-limit');
const { listPublicMasterclassReviews } = require('../services/masterclassReviewService');
const knowledgeEngineService = require('../domains/knowledge-engine/services/knowledgeEngineService');
const { triggerWebsiteRevalidate } = require('../domains/knowledge-engine/services/publishService');

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

router.get('/content/posts', publicLimiter, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const payload = await knowledgeEngineService.listPublishedPosts({
      page,
      limit,
      category: req.query.category,
      tag: req.query.tag,
    });
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, ...payload });
  } catch (err) {
    console.error('[public] content/posts error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to load posts' });
  }
});

router.get('/content/posts/:slug', publicLimiter, async (req, res) => {
  try {
    const post = await knowledgeEngineService.getPublishedPostBySlug(req.params.slug);
    if (!post) return res.status(404).json({ success: false, error: 'Not found' });
    res.set('Cache-Control', 'public, max-age=120');
    return res.json({ success: true, post });
  } catch (err) {
    console.error('[public] content/posts/:slug error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to load post' });
  }
});

router.post('/content/revalidate', publicLimiter, async (req, res) => {
  try {
    const secret = process.env.KNOWLEDGE_REVALIDATE_SECRET;
    if (!secret || req.body?.secret !== secret) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const slug = req.body?.slug;
    if (!slug) return res.status(400).json({ success: false, error: 'slug required' });
    const result = await triggerWebsiteRevalidate(slug);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
