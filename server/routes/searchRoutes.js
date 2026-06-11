const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { searchRateLimit } = require('../middleware/rateLimits');
const { search } = require('../controllers/unifiedSearchController');

router.use(protect);
router.get('/', searchRateLimit, search);

module.exports = router;
