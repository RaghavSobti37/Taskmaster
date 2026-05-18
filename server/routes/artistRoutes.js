const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artistController');
const artistAnalyticsController = require('../controllers/artistAnalyticsController');
const { protect } = require('../middleware/authMiddleware');

// Public endpoints for preview & webhooks
router.get('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.post('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.get('/:id', artistController.getArtistById);
router.get('/:id/analytics/:platform', artistAnalyticsController.getPlatformAnalytics);

// Protected endpoints
router.use(protect);
router.get('/', artistController.getArtists);
router.post('/', artistController.createArtist);
router.put('/:id', artistController.updateArtist);
router.delete('/:id', artistController.deleteArtist);
router.post('/:id/inject-event', artistController.injectEvent);
router.post('/:id/sync-stats', artistAnalyticsController.syncArtistStats);
router.post('/:id/tracked-video', artistAnalyticsController.addTrackedVideo);
router.post('/:id/webhooks/subscribe', artistAnalyticsController.enableInstagramWebhooks);
router.post('/:id/auth/meta/callback', artistAnalyticsController.metaOAuthCallback);

module.exports = router;
