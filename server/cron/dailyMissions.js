const cron = require('node-cron');
const User = require('../models/User');
const GamificationService = require('../services/gamificationService');

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Generating daily missions for all users...');
  try {
    // Get all active users
    const users = await User.find({ status: { $ne: 'suspended' } });
    
    for (const user of users) {
      if (user.tenantId) {
        await GamificationService.generateDailyMissions(user._id, user.tenantId);
      }
    }
    console.log('[CRON] Daily missions generated successfully.');
  } catch (error) {
    console.error('[CRON] Error generating daily missions:', error);
  }
});
