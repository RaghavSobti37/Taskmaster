const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const holysheetController = require('../controllers/holysheetController');
const audienceController = require('../controllers/audienceController');

const emailsAccess = requirePageAccess('emails');

router.get('/holysheet/all', protect, emailsAccess, holysheetController.fetchAll);
router.get('/audience/exly', protect, emailsAccess, audienceController.listExlyContacts);
router.get('/audience/exly/offerings', protect, emailsAccess, audienceController.listExlyOfferings);

module.exports = router;
