const express = require('express');
const router = express.Router();
const { protect, artistBodyMembershipAccess } = require('../../middleware/authMiddleware');
const connectionAuth = require('./controllers/connectionAuthController');

router.post('/connect/:provider', protect, artistBodyMembershipAccess('socials'), connectionAuth.initiateConnect);
router.get('/callback/:provider', connectionAuth.handleCallback);

module.exports = router;
