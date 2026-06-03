const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, logout, getMe, changeRequiredPassword, googleLogin, googleAuthRedirect, googleAuthCallback, oauthEstablishSession, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) {
      return `login:${email.trim().toLowerCase()}`;
    }
    return `login-ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  },
});

const authSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts. Try again later.' },
});

const authForgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Try again in an hour.' },
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) {
      return `forgot:${email.trim().toLowerCase()}`;
    }
    return `forgot-ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  },
});

router.post('/register', authSignupLimiter, register);
router.post('/login', authLoginLimiter, login);
router.post('/forgot-password', authForgotPasswordLimiter, forgotPassword);
router.post('/reset-password', authForgotPasswordLimiter, resetPassword);
router.post('/logout', logout);
router.post('/google-login', googleLogin);
router.post('/oauth-establish', authLoginLimiter, oauthEstablishSession);
router.get('/google/redirect-uri', (req, res) => {
  const { resolveGoogleRedirectUri } = require('../utils/googleAuth');
  res.json({ redirectUri: resolveGoogleRedirectUri(req) });
});
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);
router.get('/me', protect, getMe);
router.post('/change-required-password', protect, changeRequiredPassword);

module.exports = router;
