const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');
const { requireFeatureUnlock } = require('../../../middleware/requireFeatureUnlock');

const emailsAccess = requirePageAccess('emails');

router.get('/stats', protect, emailsAccess, requireFeatureUnlock('resend'), analyticsController.getStats);
router.post('/scan-bounces', protect, emailsAccess, requireFeatureUnlock('resend'), analyticsController.scanBounces);
router.get('/track/:campaignId/:recipientId', analyticsController.trackOpen);
router.get('/click/:campaignId/:recipientId', analyticsController.trackClick);
router.get('/unsubscribe/:campaignId/:recipientId', analyticsController.redirectUnsubscribe);

module.exports = router;
