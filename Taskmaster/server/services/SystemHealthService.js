const mongoose = require('mongoose');
const { validateUploadthingCredentials } = require('../utils/uploadthingCredentials');
const { getBuildMeta } = require('../utils/buildMeta');
const { pingSharedRedis } = require('../utils/sharedRedis');
const { pushEvent, seedBootEvent } = require('../utils/healthEventLog');

let systemStatus = 'STARTING';
let failReason = null;
let lastRedisState = 'unknown';

class SystemHealthService {
  static async checkDependencies() {
    try {
      // readyState 1 = connected, 2 = connecting
      if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
        throw new Error('Database disconnected or connecting failed (readyState: ' + mongoose.connection.readyState + ')');
      }

      if (process.env.REDIS_URL?.trim()) {
        try {
          const pong = await pingSharedRedis();
          lastRedisState = pong === 'PONG' ? 'connected' : 'error';
        } catch {
          lastRedisState = 'unavailable';
        }
      } else {
        lastRedisState = 'not_configured';
      }

      if (systemStatus !== 'HEALTHY') {
        pushEvent('ok', 'All dependencies healthy');
      }
      systemStatus = 'HEALTHY';
      failReason = null;
      return true;
    } catch (err) {
      if (systemStatus !== 'FAIL') {
        pushEvent('bad', err.message);
      }
      systemStatus = 'FAIL';
      failReason = err.message;
      return false;
    }
  }

  static getDetailedStatus() {
    const mongoState = mongoose.connection.readyState;
    const mongoLabels = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    let redisStatus = lastRedisState;
    if (redisStatus === 'unknown') {
      try {
        const { redisAvailable } = require('./backgroundQueue');
        redisStatus = redisAvailable ? 'connected' : 'unavailable';
      } catch {
        redisStatus = 'unavailable';
      }
    }

    let supabaseStatus = 'disabled';
    try {
      const { isSupabaseEnabled, isSupabaseConfigured } = require('../config/supabase');
      if (!isSupabaseConfigured()) {
        supabaseStatus = 'not_configured';
      } else if (!isSupabaseEnabled()) {
        supabaseStatus = 'disabled';
      } else {
        supabaseStatus = 'enabled';
      }
    } catch {
      supabaseStatus = 'unknown';
    }

    const uploadCreds = validateUploadthingCredentials();
    const uploadthing = uploadCreds.ok
      ? {
          ok: true,
          state: 'ready',
          appId: uploadCreds.appId || null,
          keyFingerprint: uploadCreds.keyFingerprint || null,
        }
      : {
          ok: false,
          state: uploadCreds.message?.includes('Missing') ? 'missing' : 'misconfigured',
          reason: uploadCreds.message,
        };

    return {
      status: systemStatus,
      reason: failReason,
      build: getBuildMeta(),
      dependencies: {
        mongodb: {
          ok: mongoState === 1 || mongoState === 2,
          state: mongoLabels[mongoState] || String(mongoState),
        },
        redis: {
          ok: redisStatus === 'connected',
          state: redisStatus,
        },
        supabase: {
          ok: supabaseStatus === 'enabled',
          state: supabaseStatus,
        },
        uploadthing,
      },
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  static getStatus() {
    return { status: systemStatus, reason: failReason };
  }

  static middleware(req, res, next) {
    if (systemStatus === 'FAIL') {
      return res.status(503).json({
        success: false,
        message: '503 Service Unavailable: Maintenance Mode',
        reason: failReason
      });
    }
    next();
  }
}

const { healthProbeLoopEnabled } = require('../utils/runtimeFlags');

// Periodic checks — skip in Jest (setup.js syncs health after in-memory Mongo connects).
if (process.env.NODE_ENV !== 'test') {
  seedBootEvent();
  if (healthProbeLoopEnabled()) {
    setInterval(SystemHealthService.checkDependencies, 15000);
  }
}

module.exports = SystemHealthService;
