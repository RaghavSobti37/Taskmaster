const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/knowledgeEngineController');

router.use(protect);
router.use(ctrl.requireKnowledgeAccess);

router.get('/dashboard', ctrl.getDashboard);
router.get('/settings', ctrl.getSettings);
router.patch('/settings', ctrl.updateSettings);

router.get('/articles', ctrl.listArticles);
router.post('/articles', ctrl.createArticle);
router.get('/articles/:id', ctrl.getArticle);
router.patch('/articles/:id', ctrl.updateArticle);
router.post('/articles/:id/approve', ctrl.approveArticle);
router.post('/articles/:id/publish', ctrl.publishArticle);
router.post('/articles/:id/images', ctrl.generateImages);
router.post('/articles/:id/medium-prep', ctrl.prepareMedium);
router.patch('/articles/:id/medium-url', ctrl.setMediumUrl);
router.post('/articles/:id/distribution', ctrl.createDistribution);

router.get('/knowledge', ctrl.searchKnowledge);
router.get('/calendar', ctrl.listCalendar);
router.post('/calendar', ctrl.upsertCalendar);
router.get('/connections', ctrl.listConnections);
router.get('/sources', ctrl.listSources);
router.get('/keywords', ctrl.listKeywords);
router.get('/opportunities', ctrl.listOpportunities);
router.get('/briefs', ctrl.listBriefs);
router.post('/opportunities/:opportunityId/brief', ctrl.generateBrief);
router.post('/pipeline/article', ctrl.runArticlePipeline);
router.get('/distribution', ctrl.listDistribution);
router.get('/outreach', ctrl.listOutreach);
router.post('/outreach', ctrl.createOutreach);
router.post('/outreach/:id/approve-send', ctrl.approveOutreach);
router.get('/analytics', ctrl.getAnalytics);
router.post('/jobs/trigger', ctrl.triggerJob);

module.exports = router;
