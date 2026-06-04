const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getSettings,
  updateSettings,
  getExclusions,
} = require('../controllers/platformSettingsController');

router.get('/exclusions', protect, getExclusions);
router.get('/', protect, admin, getSettings);
router.put('/', protect, admin, updateSettings);

module.exports = router;
