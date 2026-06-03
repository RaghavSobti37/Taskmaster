const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getOAuthReadiness } = require('../controllers/integrationsVerifyController');

router.get('/oauth-readiness', protect, admin, getOAuthReadiness);

module.exports = router;
