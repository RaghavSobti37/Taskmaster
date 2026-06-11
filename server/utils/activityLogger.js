const Log = require('../models/Log');
const logger = require('../utils/logger');
const { broadcastRealtimeEvent } = require('../config/realtime');

const logActivity = async (userId, action, targetId, targetType, details = {}, session = null) => {
  try {
    const logPayload = {
      userId,
      actorId: userId ? String(userId) : 'SYSTEM',
      origin: 'HUMAN_USER',
      action,
      targetId,
      targetType,
      details,
    };
    
    if (session) {
      await Log.create([logPayload], { session });
    } else {
      await Log.create(logPayload);
      broadcastRealtimeEvent('logs', 'log_update', { targetId, action });
    }
  } catch (err) {
    logger.error('AUDIT_ERROR', 'Critical audit logging failed:', { error: err.message || err });
    throw err; // Propagate critical audit failure to prevent unlogged mutations
  }
};

module.exports = logActivity;
