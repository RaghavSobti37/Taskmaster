const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { search } = require('../controllers/unifiedSearchController');

router.use(protect);
router.get('/', search);

module.exports = router;
