const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { config } = require('../../config');
const { authRateLimit } = require('../../middleware/rateLimits');
const { isE2eTestUser } = require('../../utils/e2eTestUsers');
const authForgotPasswordLimiter = authRateLimit;
const router = express.Router();
const {
  register, login, logout, getMe, getSession, getAuthConfig, changeRequiredPassword, googleLogin,
  googleAuthRedirect, googleAuthCallback, oauthEstablishSession, clerkEstablishSession, forgotPassword, resetPassword,
  listSessions, revokeSession, revokeOtherSessions, getRealtimeToken, adminRevokeAllUserSessions,
  mfaSetup, mfaConfirm, mfaDisable, requestAccess,
} = require('./controllers/authController');
const {
  registerOptions, registerVerify, loginOptions,
} = require('./controllers/webauthnController');
const { protect, optionalAuthenticate } = require('../../middleware/authMiddleware');
const { validateBody } = require('../../validation/validateBody');
const {
  registerBody,
  loginBody,
  forgotPasswordBody,
  resetPasswordBody,
  changeRequiredPasswordBody,
  oauthEstablishBody,
  clerkEstablishBody,
  accessRequestBody,
} = require('../../validation/schemas/auth');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  skip: (req) => process.env.NODE_ENV === 'test' || (!config.isProduction && isE2eTestUser(req.body?.email)),
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) {
      return `login:${email.trim().toLowerCase()}`;
    }
    return `login-ip:${ipKeyGenerator(req)}`;
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

const clerkEstablishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    const raw = req.body?.token;
    if (typeof raw === 'string' && raw.includes('.')) {
      try {
        const payload = JSON.parse(Buffer.from(raw.split('.')[1], 'base64url').toString('utf8'));
        if (payload?.sub) return `clerk-establish:${payload.sub}`;
      } catch {
        /* fall through */
      }
    }
    return `clerk-establish-ip:${ipKeyGenerator(req)}`;
  },
});

const authAccessRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many access requests. Try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/access-request', authAccessRequestLimiter, validateBody(accessRequestBody), requestAccess);
router.post('/register', authSignupLimiter, validateBody(registerBody), register);
router.post('/login', authLoginLimiter, validateBody(loginBody), login);
router.post('/forgot-password', authForgotPasswordLimiter, validateBody(forgotPasswordBody), forgotPassword);
router.post('/reset-password', authForgotPasswordLimiter, validateBody(resetPasswordBody), resetPassword);
router.post('/logout', logout);
router.post('/google-login', authLoginLimiter, googleLogin);
router.post('/oauth-establish', authLoginLimiter, validateBody(oauthEstablishBody), oauthEstablishSession);
router.post('/clerk-establish', clerkEstablishLimiter, validateBody(clerkEstablishBody), clerkEstablishSession);
router.get('/google/redirect-uri', (req, res) => {
  const { resolveGoogleRedirectUri } = require('../../utils/googleAuth');
  res.json({ redirectUri: resolveGoogleRedirectUri(req) });
});
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);
router.get('/config', getAuthConfig);
router.get('/session', optionalAuthenticate, getSession);
router.get('/me', protect, getMe);
router.get('/realtime-token', protect, getRealtimeToken);
router.get('/sessions', protect, listSessions);
router.delete('/sessions/:jti', protect, revokeSession);
router.post('/sessions/revoke-others', protect, revokeOtherSessions);
router.post('/change-required-password', protect, validateBody(changeRequiredPasswordBody), changeRequiredPassword);
router.post('/mfa/setup', protect, mfaSetup);
router.post('/mfa/confirm', protect, mfaConfirm);
router.post('/mfa/disable', protect, mfaDisable);

router.post('/webauthn/register/options', protect, registerOptions);
router.post('/webauthn/register/verify', protect, registerVerify);
router.post('/webauthn/login/options', authLoginLimiter, loginOptions);

module.exports = router;
