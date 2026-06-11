const express = require('express');
const router = express.Router();
const artistController = require('./controllers/artistController');
const artistAnalyticsController = require('./controllers/artistAnalyticsController');
const artistShareController = require('./controllers/artistShareController');
const artistOsController = require('./controllers/artistOsController');
const connectionAuth = require('./controllers/connectionAuthController');
const { protect, artistOrAdmin, artistTeamOrAdmin } = require('../../middleware/authMiddleware');
const { validateBody } = require('../../validation/validateBody');
const { validateParams } = require('../../validation/validateParams');
const {
  createArtistBody,
  updateArtistBody,
  injectEventBody,
  artistConnectionParams,
  trackedVideoBody,
} = require('../../validation/schemas/artist');

const callback = (provider) => (req, res) => {
  req.params.provider = provider;
  return connectionAuth.handleCallback(req, res);
};

router.get('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.post('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.get('/:id/preview', artistShareController.getArtistPreview);

router.get('/auth/callback/spotify', callback('spotify'));
router.get('/auth/callback/youtube', callback('youtube'));

router.post('/:id/auth/meta/callback', artistAnalyticsController.metaOAuthCallback);

router.get('/:id/auth/spotify', connectionAuth.legacySpotifyRedirect);
router.get('/:id/auth/youtube', connectionAuth.legacyYoutubeRedirect);

router.use(protect);

router.get('/config/integrations', artistOrAdmin, artistController.getIntegrationsConfig);
router.get('/', artistOrAdmin, artistController.getArtists);
router.post('/', artistOrAdmin, validateBody(createArtistBody), artistController.createArtist);
router.get('/:id/connections', artistTeamOrAdmin, artistController.getArtistConnections);
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
router.get('/:id/analytics/:platform', artistTeamOrAdmin, artistAnalyticsController.getPlatformAnalytics);

router.get('/:id/os/overview', artistTeamOrAdmin, artistOsController.getOverview);
router.get('/:id/os/inquiries', artistTeamOrAdmin, artistOsController.getInquiries);
router.post('/:id/os/inquiries', artistTeamOrAdmin, artistOsController.createInquiry);
router.patch('/:id/os/inquiries/:inquiryId', artistTeamOrAdmin, artistOsController.updateInquiry);
router.get('/:id/os/gigs', artistTeamOrAdmin, artistOsController.getGigs);
router.post('/:id/os/gigs', artistTeamOrAdmin, artistOsController.createGig);
router.patch('/:id/os/gigs/:gigId', artistTeamOrAdmin, artistOsController.updateGig);
router.get('/:id/os/finance', artistTeamOrAdmin, artistOsController.getFinance);
router.post('/:id/os/finance', artistTeamOrAdmin, artistOsController.createFinanceEntry);
router.post('/:id/os/finance/ocr', artistTeamOrAdmin, artistOsController.financeOcr);
router.get('/:id/os/calendar', artistTeamOrAdmin, artistOsController.getCalendar);
router.post('/:id/os/calendar', artistTeamOrAdmin, artistOsController.createCalendarEvent);
router.get('/:id/os/timeline', artistTeamOrAdmin, artistOsController.getTimeline);
router.get('/:id/os/analytics/scores', artistTeamOrAdmin, artistOsController.getAnalyticsScores);
router.get('/:id/os/analytics/demographics', artistTeamOrAdmin, artistOsController.getDemographics);
router.get('/:id/os/documents', artistTeamOrAdmin, artistOsController.getDocuments);
router.post('/:id/os/documents', artistTeamOrAdmin, artistOsController.createDocument);
router.get('/:id/os/contracts', artistTeamOrAdmin, artistOsController.getContracts);
router.post('/:id/os/contracts', artistTeamOrAdmin, artistOsController.createContract);
router.get('/:id/os/notes', artistTeamOrAdmin, artistOsController.getNotes);
router.post('/:id/os/notes', artistTeamOrAdmin, artistOsController.createNote);
router.get('/:id/os/content', artistTeamOrAdmin, artistOsController.getContent);
router.post('/:id/os/content', artistTeamOrAdmin, artistOsController.createContent);

router.get('/:id', artistTeamOrAdmin, artistController.getArtistById);

module.exports = router;
