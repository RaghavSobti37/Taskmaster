const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const holysheetController = require('../controllers/holysheetController');

const emailsAccess = requirePageAccess('emails');

router.get('/holysheet/all', protect, emailsAccess, holysheetController.fetchAll);

module.exports = router;
