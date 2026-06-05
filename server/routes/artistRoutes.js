const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artistController');
const artistAnalyticsController = require('../controllers/artistAnalyticsController');
const artistShareController = require('../controllers/artistShareController');
const connectionAuth = require('../controllers/connectionAuthController');
const { protect, artistOrAdmin } = require('../middleware/authMiddleware');
const { validateBody } = require('../validation/validateBody');
const { validateParams } = require('../validation/validateParams');
const {
  createArtistBody,
  updateArtistBody,
  injectEventBody,
  artistConnectionParams,
  trackedVideoBody,
} = require('../validation/schemas/artist');

const callback = (provider) => (req, res) => {
  req.params.provider = provider;
  return connectionAuth.handleCallback(req, res);
};

// ─── Public endpoints ─────────────────────────────────────────────────────────
// Legacy Meta webhook — prefer /api/webhooks/instagram (signature verification). Kept for backward compatibility.
router.get('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.post('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.get('/config/integrations', artistController.getIntegrationsConfig);
router.get('/:id/preview', artistShareController.getArtistPreview);

// Unified + legacy OAuth callbacks (same redirect URIs registered in Spotify/Google consoles)
router.get('/auth/callback/spotify', callback('spotify'));
router.get('/auth/callback/youtube', callback('youtube'));

router.post('/:id/auth/meta/callback', artistAnalyticsController.metaOAuthCallback);

// Legacy initiate redirects
router.get('/:id/auth/spotify', connectionAuth.legacySpotifyRedirect);
router.get('/:id/auth/youtube', connectionAuth.legacyYoutubeRedirect);

// ─── Protected endpoints ──────────────────────────────────────────────────────
router.use(protect);

router.get('/', artistController.getArtists);
router.post('/', artistOrAdmin, validateBody(createArtistBody), artistController.createArtist);
router.get('/:id/connections', artistController.getArtistConnections);
router.post('/:id/share-link', artistOrAdmin, artistShareController.createShareLink);
router.post('/:id/claim', artistShareController.claimArtistWorkspace);
router.put(
  '/:id/connections/:connectionId/primary',
  artistOrAdmin,
  validateParams(artistConnectionParams),
  artistController.setPrimaryConnection,
);
router.put('/:id', artistOrAdmin, validateBody(updateArtistBody), artistController.updateArtist);
router.delete('/:id', artistOrAdmin, artistController.deleteArtist);
router.post('/:id/inject-event', artistOrAdmin, validateBody(injectEventBody), artistController.injectEvent);
router.post('/:id/sync-stats', artistOrAdmin, artistAnalyticsController.syncArtistStats);
router.post('/:id/tracked-video', artistOrAdmin, validateBody(trackedVideoBody), artistAnalyticsController.addTrackedVideo);
router.post('/:id/webhooks/subscribe', artistOrAdmin, artistAnalyticsController.enableInstagramWebhooks);
router.get('/:id/analytics/:platform', artistOrAdmin, artistAnalyticsController.getPlatformAnalytics);
router.get('/:id', artistController.getArtistById);

module.exports = router;
