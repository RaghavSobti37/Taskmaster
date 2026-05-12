const User = require('../models/User');

module.exports = async (req, res, next) => {
  if (req.user && req.user._id) {
    try {
      // Update lastOnline only if more than 1 minute since last update
      const now = new Date();
      const lastUpdate = req.user.lastOnline || new Date(0);
      if (now - lastUpdate > 60000) {
        await User.findByIdAndUpdate(req.user._id, { 
          $set: { lastOnline: now, online: true } 
        });
      }
    } catch (err) {
      console.error('Presence sync fail:', err);
    }
  }
  next();
};