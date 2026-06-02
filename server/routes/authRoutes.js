const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, logout, getMe, googleLogin, googleAuthRedirect, googleAuthCallback } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const authSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts. Try again later.' },
});

router.post('/register', authSignupLimiter, register);
router.post('/login', authLoginLimiter, login);
router.post('/logout', logout);
router.post('/google-login', googleLogin);
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);
router.get('/me', protect, getMe);


module.exports = router;
