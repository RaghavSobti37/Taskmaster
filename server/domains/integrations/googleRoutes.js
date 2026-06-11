const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const {
  getCalendarEvents,
  getDriveFiles,
  linkGoogleAccount,
  getIndianHolidays,
} = require('./controllers/googleController');

router.get('/holidays', protect, getIndianHolidays);
router.post('/link', protect, linkGoogleAccount);
router.get('/calendar/events', protect, getCalendarEvents);
router.get('/drive/files', protect, getDriveFiles);

module.exports = router;
