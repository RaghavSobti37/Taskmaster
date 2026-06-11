const express = require('express');
const rateLimit = require('express-rate-limit');
const { config } = require('../../config');
const { authRateLimit } = require('../../middleware/rateLimits');
const { isE2eTestUser } = require('../../utils/e2eTestUsers');
const authForgotPasswordLimiter = authRateLimit;
const router = express.Router();
const {
  register, login, logout, getMe, changeRequiredPassword, googleLogin,
  googleAuthRedirect, googleAuthCallback, oauthEstablishSession, forgotPassword, resetPassword,
  listSessions, revokeSession, revokeOtherSessions, getRealtimeToken,
} = require('./controllers/authController');
const { protect } = require('../../middleware/authMiddleware');
const { validateBody } = require('../../validation/validateBody');
const {
  registerBody,
  loginBody,
  forgotPasswordBody,
  resetPasswordBody,
  changeRequiredPasswordBody,
  oauthEstablishBody,
} = require('../../validation/schemas/auth');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  skip: (req) => !config.isProduction && isE2eTestUser(req.body?.email),
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
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/register', authSignupLimiter, validateBody(registerBody), register);
router.post('/login', authLoginLimiter, validateBody(loginBody), login);
router.post('/forgot-password', authForgotPasswordLimiter, validateBody(forgotPasswordBody), forgotPassword);
router.post('/reset-password', authForgotPasswordLimiter, validateBody(resetPasswordBody), resetPassword);
router.post('/logout', logout);
router.post('/google-login', googleLogin);
router.post('/oauth-establish', authLoginLimiter, validateBody(oauthEstablishBody), oauthEstablishSession);
router.get('/google/redirect-uri', (req, res) => {
  const { resolveGoogleRedirectUri } = require('../../utils/googleAuth');
  res.json({ redirectUri: resolveGoogleRedirectUri(req) });
});
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);
router.get('/me', protect, getMe);
router.get('/realtime-token', protect, getRealtimeToken);
router.get('/sessions', protect, listSessions);
router.delete('/sessions/:jti', protect, revokeSession);
router.post('/sessions/revoke-others', protect, revokeOtherSessions);
router.post('/change-required-password', protect, validateBody(changeRequiredPasswordBody), changeRequiredPassword);

module.exports = router;
