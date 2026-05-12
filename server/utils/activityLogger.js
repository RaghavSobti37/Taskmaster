const Log = require('../models/Log');

const logActivity = async (userId, action, targetId, targetType, details = {}) => {
  try {
    await Log.create({
      userId,
      action,
      targetId,
      targetType,
      details
    });
  } catch (err) {
    console.error('Logging failed:', err);
  }
};

module.exports = logActivity;
