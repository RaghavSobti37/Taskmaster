const mongoose = require('mongoose');

let systemStatus = 'STARTING';
let failReason = null;

class SystemHealthService {
  static async checkDependencies() {
    try {
      // readyState 1 = connected, 2 = connecting
      if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
        throw new Error('Database disconnected or connecting failed (readyState: ' + mongoose.connection.readyState + ')');
      }

      const { redisAvailable } = require('./backgroundQueue');
      if (redisAvailable === false) {
        // Just a warning, not fatal for this system, but could be logged
      }

      systemStatus = 'HEALTHY';
      failReason = null;
      return true;
    } catch (err) {
      systemStatus = 'FAIL';
      failReason = err.message;
      return false;
    }
  }

  static getDetailedStatus() {
    const mongoState = mongoose.connection.readyState;
    const mongoLabels = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    let redisStatus = 'unknown';
    try {
      const { redisAvailable } = require('./backgroundQueue');
      redisStatus = redisAvailable ? 'connected' : 'unavailable';
    } catch {
      redisStatus = 'unavailable';
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

    return {
      status: systemStatus,
      reason: failReason,
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

// Start periodic checks
setInterval(SystemHealthService.checkDependencies, 15000);

module.exports = SystemHealthService;
