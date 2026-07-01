const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { apiOk, apiError } = require('../utils/apiResponse');
const { config } = require('../config');
const { generateSessionToken } = require('../utils/authSession');

const router = express.Router();

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Proxy sync token issuance to NestJS when configured, else issue dev stub (localhost only).
 */
router.post(
  '/token',
  protect,
  asyncHandler(async (req, res) => {
    const nestBase =
      config.NEST_SYNC_URL ||
      process.env.NEST_SYNC_URL ||
      `http://127.0.0.1:${config.NEST_PORT || 5001}`;

    // Mint legacy session JWT so Nest AuthGuard accepts Clerk-authenticated users from Express.
    const internalToken = generateSessionToken(req.user._id.toString());

    try {
      const response = await axios.post(
        `${nestBase}/api/v1/sync/token`,
        {},
        {
          headers: {
            Authorization: `Bearer ${internalToken}`,
          },
          timeout: 5000,
          validateStatus: () => true,
        },
      );

      if (response.status >= 200 && response.status < 300) {
        return apiOk(res, response.data);
      }
    } catch {
      // fall through to dev stub
    }

    if (config.isDevelopment && LOCALHOST_IPS.has(req.ip)) {
      const jwt = require('jsonwebtoken');
      const secret = config.JWT_SECRET || 'dev-sync-secret';
      const token = jwt.sign(
        {
          sub: req.user._id.toString(),
          tenantId: req.user.tenantId?.toString(),
          purpose: 'powersync',
        },
        secret,
        { expiresIn: '12h' },
      );
      return apiOk(res, {
        endpoint: config.POWERSYNC_URL || 'http://127.0.0.1:8080',
        token,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      });
    }

    return apiError(res, 'Sync service unavailable', 503);
  }),
);

/** Remote service worker kill-switch — returns unregister directive for clients. */
router.get(
  '/sw-killswitch',
  asyncHandler(async (_req, res) => {
    const active = String(config.SW_KILL_SWITCH || '').trim() === 'true';
    return apiOk(res, { unregister: active, reason: active ? 'remote_kill_switch' : null });
  }),
);

module.exports = router;
