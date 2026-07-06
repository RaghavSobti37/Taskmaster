const express = require('express');
const router = express.Router();
const { protect, requirePageAccess, admin } = require('../../../middleware/authMiddleware');
const holysheetController = require('../controllers/holysheetController');
const audienceController = require('../controllers/audienceController');
const { requireFeatureUnlock } = require('../../../middleware/requireFeatureUnlock');

const emailsAccess = requirePageAccess('emails');

router.get('/holysheet/all', protect, emailsAccess, requireFeatureUnlock('resend'), holysheetController.fetchAll);
router.get('/audience/exly', protect, emailsAccess, requireFeatureUnlock('resend'), audienceController.listExlyContacts);
router.get('/audience/exly/offerings', protect, emailsAccess, requireFeatureUnlock('resend'), audienceController.listExlyOfferings);
router.get('/audience/data-hub', protect, emailsAccess, admin, requireFeatureUnlock('resend'), audienceController.listDataHubContacts);
router.get('/audience/data-hub/folders', protect, emailsAccess, admin, requireFeatureUnlock('resend'), audienceController.listDataHubFolders);
router.post('/audience/engagement', protect, emailsAccess, requireFeatureUnlock('resend'), audienceController.resolveAudienceEngagement);

module.exports = router;
