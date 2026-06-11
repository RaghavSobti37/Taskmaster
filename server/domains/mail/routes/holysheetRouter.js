const express = require('express');
const router = express.Router();
const { protect, requirePageAccess, admin } = require('../../../middleware/authMiddleware');
const holysheetController = require('../controllers/holysheetController');
const audienceController = require('../controllers/audienceController');

const emailsAccess = requirePageAccess('emails');

router.get('/holysheet/all', protect, emailsAccess, holysheetController.fetchAll);
router.get('/audience/exly', protect, emailsAccess, audienceController.listExlyContacts);
router.get('/audience/exly/offerings', protect, emailsAccess, audienceController.listExlyOfferings);
router.get('/audience/data-hub', protect, emailsAccess, admin, audienceController.listDataHubContacts);
router.get('/audience/data-hub/folders', protect, emailsAccess, admin, audienceController.listDataHubFolders);

module.exports = router;
