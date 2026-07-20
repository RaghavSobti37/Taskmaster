const express = require('express');
const NewsletterIssue = require('../models/NewsletterIssue');
const NewsletterArticle = require('../models/NewsletterArticle');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');

const emailsAccess = requirePageAccess('emails');
const { validateBody } = require('../validation/validateBody');
const {
  previewLinkBody,
  createArticleBody,
  patchArticleBody,
  curateIssueBody,
  audiencePreviewBody,
} = require('../validation/schemas/newsletter');
const { NEWSLETTER_ARTICLE_CATEGORIES } = require('../constants/newsletterCategories');
const { getCurrentWeekKey, getWeekBounds } = require('../utils/newsletterWeek');
const { previewLink, normalizeUrl } = require('../services/newsletterLinkPreviewService');
const { compileNewsletterHtml } = require('../services/newsletterCompileService');
const { resolveNewsletterAudience } = require('../services/newsletterAudienceService');

const router = express.Router();

router.use(protect, emailsAccess);

const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

const handleNewsletterRouteError = (res, err) => {
  if (err?.status === 410 && err?.service === 'auto-mailer') {
    return res.status(410).json({
      error: err.message,
      service: err.service,
      url: err.url,
    });
  }
  return handleNewsletterRouteError(res, err);
};

const serializeArticle = (doc) => {
  if (!doc) return null;
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    ...row,
    addedByUser: row.addedBy && typeof row.addedBy === 'object'
      ? { _id: row.addedBy._id, name: row.addedBy.name, email: row.addedBy.email }
      : undefined,
  };
};

const getOrCreateIssueByWeekKey = async (weekKey) => {
  const bounds = getWeekBounds(weekKey);
  if (!bounds) throw new Error('Invalid week key');

  let issue = await NewsletterIssue.findOne({ weekKey });
  if (!issue) {
    issue = await NewsletterIssue.create({
      weekKey,
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
      status: 'collecting',
    });
  }
  return issue;
};

const loadIssueBundle = async (issueId) => {
  const issue = await NewsletterIssue.findById(issueId);
  if (!issue) return null;
  const articles = await NewsletterArticle.find({ issueId: issue._id })
    .sort({ sortOrder: 1, createdAt: 1 })
    .populate('addedBy', 'name email')
    .lean();
  return {
    issue: issue.toObject(),
    articles: articles.map(serializeArticle),
  };
};

router.get('/categories', (_req, res) => {
  res.json(NEWSLETTER_ARTICLE_CATEGORIES);
});

router.get('/issues/current', async (req, res) => {
  try {
    const weekKey = getCurrentWeekKey();
    const issue = await getOrCreateIssueByWeekKey(weekKey);
    const bundle = await loadIssueBundle(issue._id);
    res.json(bundle);
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.get('/issues/:weekKey', async (req, res) => {
  try {
    if (/^[a-f0-9]{24}$/i.test(req.params.weekKey)) {
      const issue = await NewsletterIssue.findById(req.params.weekKey);
      if (!issue) return res.status(404).json({ error: 'Issue not found' });
      const bundle = await loadIssueBundle(issue._id);
      return res.json(bundle);
    }
    const issue = await NewsletterIssue.findOne({ weekKey: req.params.weekKey });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    const bundle = await loadIssueBundle(issue._id);
    res.json(bundle);
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.post('/links/preview', validateBody(previewLinkBody), async (req, res) => {
  try {
    const preview = await previewLink(req.body.url);
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/articles', validateBody(createArticleBody), async (req, res) => {
  try {
    let issue;
    if (req.body.issueId) {
      issue = await NewsletterIssue.findById(req.body.issueId);
      if (!issue) return res.status(404).json({ error: 'Issue not found' });
      if (issue.status === 'sent') {
        return res.status(400).json({ error: 'Cannot add articles to a sent issue' });
      }
    } else {
      issue = await getOrCreateIssueByWeekKey(getCurrentWeekKey());
    }

    const urlObj = normalizeUrl(req.body.url);
    if (!urlObj) return res.status(400).json({ error: 'Invalid URL' });

    const existing = await NewsletterArticle.findOne({
      issueId: issue._id,
      canonicalUrl: urlObj.href,
    });
    if (existing) {
      return res.status(409).json({ error: 'This link is already saved for this week', article: serializeArticle(existing) });
    }

    const preview = await previewLink(req.body.url);
    const count = await NewsletterArticle.countDocuments({ issueId: issue._id });

    const article = await NewsletterArticle.create({
      issueId: issue._id,
      url: preview.url || urlObj.href,
      canonicalUrl: preview.canonicalUrl || urlObj.href,
      category: req.body.category || 'other',
      title: req.body.title || preview.title || urlObj.hostname,
      description: req.body.description || preview.description || '',
      imageUrl: req.body.imageUrl || preview.imageUrl || '',
      siteName: req.body.siteName || preview.siteName || urlObj.hostname.replace(/^www\./, ''),
      fetchStatus: req.body.title ? 'manual' : preview.fetchStatus,
      notes: req.body.notes || '',
      sortOrder: count,
      addedBy: req.user._id,
      included: true,
    });

    await article.populate('addedBy', 'name email');

    const GamificationService = require('../services/gamificationService');
    await GamificationService.generateWeeklyMissions(req.user._id);
    await GamificationService.progressMission(req.user._id, 'NEWSLETTER_ARTICLE', 1);

    res.status(201).json(serializeArticle(article));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This link is already saved for this week' });
    }
    handleNewsletterRouteError(res, err);
  }
});

router.patch('/articles/:id', validateBody(patchArticleBody), async (req, res) => {
  try {
    const article = await NewsletterArticle.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const issue = await NewsletterIssue.findById(article.issueId);
    if (issue?.status === 'sent') {
      return res.status(400).json({ error: 'Cannot edit articles in a sent issue' });
    }

    const isOwner = article.addedBy?.toString() === req.user._id.toString();
    if (!isOwner && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not allowed to edit this article' });
    }

    const updates = { ...req.body };
    if (updates.title || updates.description || updates.imageUrl) {
      updates.fetchStatus = updates.fetchStatus || 'manual';
    }
    Object.assign(article, updates);
    await article.save();
    await article.populate('addedBy', 'name email');
    res.json(serializeArticle(article));
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.delete('/articles/:id', async (req, res) => {
  try {
    const article = await NewsletterArticle.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const issue = await NewsletterIssue.findById(article.issueId);
    if (issue?.status === 'sent') {
      return res.status(400).json({ error: 'Cannot delete articles from a sent issue' });
    }

    const isOwner = article.addedBy?.toString() === req.user._id.toString();
    if (!isOwner && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not allowed to delete this article' });
    }

    await article.deleteOne();
    res.json({ success: true });
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.patch('/issues/:id/curate', validateBody(curateIssueBody), async (req, res) => {
  try {
    const issue = await NewsletterIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (issue.status === 'sent') {
      return res.status(400).json({ error: 'Issue already sent' });
    }

    if (req.body.introTitle !== undefined) issue.introTitle = req.body.introTitle;
    if (req.body.introBlurb !== undefined) issue.introBlurb = req.body.introBlurb;
    if (req.body.status) issue.status = req.body.status;

    if (Array.isArray(req.body.articles)) {
      await Promise.all(req.body.articles.map(async (row) => {
        const patch = {};
        if (row.sortOrder !== undefined) patch.sortOrder = row.sortOrder;
        if (row.included !== undefined) patch.included = row.included;
        if (!Object.keys(patch).length) return;
        await NewsletterArticle.updateOne(
          { _id: row.id, issueId: issue._id },
          { $set: patch },
        );
      }));
    }

    await issue.save();
    const bundle = await loadIssueBundle(issue._id);
    res.json(bundle);
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.post('/issues/:id/compile', async (req, res) => {
  try {
    const issue = await NewsletterIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (issue.status === 'sent') {
      return res.status(400).json({ error: 'Issue already sent' });
    }

    const articles = await NewsletterArticle.find({ issueId: issue._id, included: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    if (!articles.length) {
      return res.status(400).json({ error: 'Add at least one included article before compiling' });
    }

    const compiledHtml = compileNewsletterHtml({ issue, articles });
    issue.compiledHtml = compiledHtml;
    issue.compiledAt = new Date();
    issue.status = 'ready';
    await issue.save();

    res.json({
      issue: issue.toObject(),
      articleCount: articles.length,
      compiledHtml,
    });
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.get('/issues/:id/preview', async (req, res) => {
  try {
    const issue = await NewsletterIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    let html = issue.compiledHtml;
    if (!html) {
      const articles = await NewsletterArticle.find({ issueId: issue._id, included: true })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean();
      html = compileNewsletterHtml({ issue, articles });
    }

    res.json({ html, issue: issue.toObject() });
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.post('/issues/:id/audience-preview', validateBody(audiencePreviewBody), async (req, res) => {
  try {
    const result = await resolveNewsletterAudience(req.body.audience, req.body.excludedEmails);
    res.json(result);
  } catch (err) {
    handleNewsletterRouteError(res, err);
  }
});

router.post('/issues/:id/send', async (req, res) => {
  const origin = String(process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app').replace(/\/+$/, '');
  return res.status(410).json({
    error: 'Newsletter sending moved to Auto-Mailer',
    service: 'auto-mailer',
    url: `${origin}/campaigns/new`,
  });
});
module.exports = router;
