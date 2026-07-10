const express = require('express');
const { protect } = require('../../middleware/authMiddleware');
const asyncHandler = require('../../middleware/asyncHandler');
const ctrl = require('./controllers/integrationHubController');

const router = express.Router();

// Public OAuth callback + inbound webhooks
router.get('/oauth/callback/:provider', ctrl.oauthCallback);
router.post(
  '/webhooks/inbound/:tenantSlug/:integrationId',
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }),
  ctrl.inboundWebhook,
);

// Admin readiness (legacy)
router.get('/oauth-readiness', protect, ctrl.oauthReadiness);

// Tenant integration hub (org admin)
router.use(protect, ctrl.requireTenantAdmin);
router.get('/providers', ctrl.listProviders);
router.get('/connections', ctrl.listConnections);
router.post('/:provider/connect', ctrl.connect);
router.post('/connections/:id/disconnect', ctrl.disconnect);
router.post('/connections/:id/health', ctrl.health);
router.post('/connections/:id/sync', ctrl.sync);
router.patch('/connections/:id/metadata', ctrl.patchMetadata);

module.exports = router;
