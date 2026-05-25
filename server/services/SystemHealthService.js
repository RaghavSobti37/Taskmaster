const mongoose = require('mongoose');

let systemStatus = 'STARTING';
let failReason = null;

class SystemHealthService {
  static async checkDependencies() {
    try {
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database disconnected');
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
