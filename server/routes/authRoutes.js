const express = require('express');
const router = express.Router();
const { register, login, getMe, googleLogin, googleAuthRedirect, googleAuthCallback } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);
router.get('/me', protect, getMe);


module.exports = router;
