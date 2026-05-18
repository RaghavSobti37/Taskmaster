const Log = require('../models/Log');

const logActivity = async (userId, action, targetId, targetType, details = {}, session = null) => {
  try {
    const logPayload = {
      userId,
      action,
      targetId,
      targetType,
      details
    };
    
    if (session) {
      await Log.create([logPayload], { session });
    } else {
      await Log.create(logPayload);
    }
  } catch (err) {
    console.error('[AUDIT_ERROR] Critical audit logging failed:', err);
    throw err; // Propagate critical audit failure to prevent unlogged mutations
  }
};

module.exports = logActivity;
