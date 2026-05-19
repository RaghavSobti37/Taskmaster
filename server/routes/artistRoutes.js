const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artistController');
const artistAnalyticsController = require('../controllers/artistAnalyticsController');
const spotifyAuthController = require('../controllers/spotifyAuthController');
const youtubeAuthController = require('../controllers/youtubeAuthController');
const { protect } = require('../middleware/authMiddleware');

// ─── Public endpoints (webhooks, OAuth callbacks, Spotify OAuth) ──────────────
router.get('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.post('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);

// Spotify OAuth — both routes public (browser redirects, no JWT)
router.get('/:id/auth/spotify', spotifyAuthController.initiateSpotifyAuth);
router.get('/auth/callback/spotify', spotifyAuthController.spotifyAuthCallback);

// YouTube OAuth — both routes public
router.get('/:id/auth/youtube', youtubeAuthController.initiateYouTubeAuth);
router.get('/auth/callback/youtube', youtubeAuthController.youTubeAuthCallback);

router.post('/:id/auth/meta/callback', artistAnalyticsController.metaOAuthCallback);
router.get('/:id/analytics/:platform', artistAnalyticsController.getPlatformAnalytics);

// ─── Protected endpoints ──────────────────────────────────────────────────────
router.use(protect);
router.get('/', artistController.getArtists);
router.post('/', artistController.createArtist);
router.put('/:id', artistController.updateArtist);
router.delete('/:id', artistController.deleteArtist);
router.post('/:id/inject-event', artistController.injectEvent);
router.post('/:id/sync-stats', artistAnalyticsController.syncArtistStats);
router.post('/:id/tracked-video', artistAnalyticsController.addTrackedVideo);
router.post('/:id/webhooks/subscribe', artistAnalyticsController.enableInstagramWebhooks);

// Artist by ID must come after protect so auth works (but getArtistById is public above)
router.get('/:id', artistController.getArtistById);

module.exports = router;
