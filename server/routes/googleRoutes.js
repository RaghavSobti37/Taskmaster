const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getCalendarEvents, 
  createCalendarEvent,
  getDriveFiles,
  linkGoogleAccount
} = require('../controllers/googleController');

router.post('/link', protect, linkGoogleAccount);
router.get('/calendar/events', protect, getCalendarEvents);
router.post('/calendar/events', protect, createCalendarEvent);
router.get('/drive/files', protect, getDriveFiles);

module.exports = router;
