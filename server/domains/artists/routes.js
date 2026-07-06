const express = require('express');
const router = express.Router();
const artistController = require('./controllers/artistController');
const artistAnalyticsController = require('./controllers/artistAnalyticsController');
const artistShareController = require('./controllers/artistShareController');
const artistOsController = require('./controllers/artistOsController');
const artistMembershipController = require('./controllers/artistMembershipController');
const artistWorkspaceController = require('./controllers/artistWorkspaceController');
const connectionAuth = require('./controllers/connectionAuthController');
const connectionHubController = require('./controllers/connectionHubController');
const {
  protect,
  artistOrAdmin,
  artistTeamOrAdmin,
  artistMembershipAccess,
  canManageArtistTeam,
  artistOwnerOrAdmin,
} = require('../../middleware/authMiddleware');
const { validateBody } = require('../../validation/validateBody');
const { validateParams } = require('../../validation/validateParams');
const {
  createArtistBody,
  updateArtistBody,
  injectEventBody,
  artistConnectionParams,
  trackedVideoBody,
} = require('../../validation/schemas/artist');
const { requireFeatureUnlock } = require('../../middleware/requireFeatureUnlock');

const callback = (provider) => (req, res) => {
  req.params.provider = provider;
  return connectionAuth.handleCallback(req, res);
};

router.get('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.post('/webhook/meta', artistAnalyticsController.metaMentionsWebhook);
router.get('/:id/preview', artistShareController.getArtistPreview);

router.get('/public/:slug', artistController.getPublicArtistBySlug);
router.post('/public/:slug/inquiry', artistController.createPublicInquiry);

router.get('/auth/callback/spotify', callback('spotify'));
router.get('/auth/callback/youtube', callback('youtube'));

router.post('/:id/auth/meta/callback', artistAnalyticsController.metaOAuthCallback);

router.get('/:id/auth/spotify', connectionAuth.legacySpotifyRedirect);
router.get('/:id/auth/youtube', connectionAuth.legacyYoutubeRedirect);

router.use(protect);
router.use(requireFeatureUnlock('artistOs'));

router.get('/config/integrations', artistOrAdmin, artistController.getIntegrationsConfig);
router.get('/portfolio/summary', artistOrAdmin, artistController.getPortfolioSummary);
router.get('/', artistOrAdmin, artistController.getArtists);
router.post('/', artistOrAdmin, validateBody(createArtistBody), artistController.createArtist);
router.get('/:id/connections', artistTeamOrAdmin, artistController.getArtistConnections);
router.get('/:id/connections/hub', artistMembershipAccess('socials'), connectionHubController.getConnectionHub);
router.get('/:id/connections/health', artistMembershipAccess('socials'), connectionHubController.getConnectionHealth);
router.post('/:id/connections/:platform/sync', artistMembershipAccess('socials'), connectionHubController.syncPlatformConnection);
router.put('/:id/connections/:platform/manual', artistMembershipAccess('socials'), connectionHubController.saveManualConnection);
router.get('/:id/members', artistOwnerOrAdmin, artistMembershipController.listMembers);
router.get('/:id/membership/me', artistMembershipController.getMyMembership);
router.post('/:id/members/invite', canManageArtistTeam, artistMembershipController.inviteMember);
router.post('/:id/members/accept', artistMembershipController.acceptMembership);
router.patch('/:id/members/:membershipId', canManageArtistTeam, artistMembershipController.updateMember);
router.delete('/:id/members/:membershipId', canManageArtistTeam, artistMembershipController.removeMember);
router.post('/:id/share-link', artistOrAdmin, artistShareController.createShareLink);
router.post('/:id/claim', artistShareController.claimArtistWorkspace);
router.put(
  '/:id/connections/:connectionId/primary',
  artistMembershipAccess('socials'),
  validateParams(artistConnectionParams),
  artistController.setPrimaryConnection,
);
router.put('/:id', artistOrAdmin, validateBody(updateArtistBody), artistController.updateArtist);
router.delete('/:id', artistOrAdmin, artistController.deleteArtist);
router.post('/:id/inject-event', artistOrAdmin, validateBody(injectEventBody), artistController.injectEvent);
router.post('/:id/sync-stats', artistMembershipAccess('socials'), artistAnalyticsController.syncArtistStats);
router.post('/:id/tracked-video', artistMembershipAccess('socials'), validateBody(trackedVideoBody), artistAnalyticsController.addTrackedVideo);
router.post('/:id/webhooks/subscribe', artistMembershipAccess('socials'), artistAnalyticsController.enableInstagramWebhooks);
router.get('/:id/analytics/:platform', artistTeamOrAdmin, artistAnalyticsController.getPlatformAnalytics);

router.get('/:id/os/overview', artistTeamOrAdmin, artistOsController.getOverview);
router.get('/:id/os/inquiries', artistMembershipAccess('booking'), artistOsController.getInquiries);
router.post('/:id/os/inquiries', artistMembershipAccess('booking'), artistOsController.createInquiry);
router.patch('/:id/os/inquiries/:inquiryId', artistMembershipAccess('booking'), artistOsController.updateInquiry);
router.get('/:id/os/gigs', artistMembershipAccess('booking'), artistOsController.getGigs);
router.post('/:id/os/gigs', artistMembershipAccess('booking'), artistOsController.createGig);
router.patch('/:id/os/gigs/:gigId', artistMembershipAccess('booking'), artistOsController.updateGig);
router.get('/:id/os/finance', artistMembershipAccess('finance'), artistOsController.getFinance);
router.post('/:id/os/finance', artistMembershipAccess('finance'), artistOsController.createFinanceEntry);
router.post('/:id/os/finance/ocr', artistMembershipAccess('finance'), artistOsController.financeOcr);
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

router.get('/:id/os/assets', artistMembershipAccess('content'), artistWorkspaceController.getAssets);
router.post('/:id/os/assets', artistMembershipAccess('content'), artistWorkspaceController.createAsset);
router.patch('/:id/os/assets/:assetId', artistMembershipAccess('content'), artistWorkspaceController.updateAsset);
router.delete('/:id/os/assets/:assetId', artistMembershipAccess('content'), artistWorkspaceController.deleteAsset);
router.get('/:id/os/releases', artistMembershipAccess('content'), artistWorkspaceController.getReleaseCampaigns);
router.post('/:id/os/releases', artistMembershipAccess('content'), artistWorkspaceController.createReleaseCampaign);
router.patch('/:id/os/releases/:releaseId', artistMembershipAccess('content'), artistWorkspaceController.updateReleaseCampaign);
router.delete('/:id/os/releases/:releaseId', artistMembershipAccess('content'), artistWorkspaceController.deleteReleaseCampaign);

router.get('/:id', artistTeamOrAdmin, artistController.getArtistById);

module.exports = router;
