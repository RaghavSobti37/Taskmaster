const express = require('express');
const router = express.Router();
const connectionAuth = require('../controllers/connectionAuthController');
const { protect, artistOrAdmin } = require('../middleware/authMiddleware');

router.post('/connect/:provider', protect, artistOrAdmin, connectionAuth.initiateConnect);
router.get('/callback/:provider', connectionAuth.handleCallback);

module.exports = router;
