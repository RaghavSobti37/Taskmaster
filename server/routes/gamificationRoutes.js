const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const DailyMission = require('../models/DailyMission');
const { protect } = require('../middleware/authMiddleware');

// Get active missions
router.get('/missions', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Auto-generate if missing
    await GamificationService.generateDailyMissions(req.user._id);

    const missions = await DailyMission.find({
      userId: req.user._id,
      date: { $gte: today }
    });

    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user progress details
router.get('/progress', protect, async (req, res) => {
  try {
    const user = req.user;
    const currentLevelExp = GamificationService.getExpForLevel(user.level || 1);
    const nextLevelExp = GamificationService.getExpForLevel((user.level || 1) + 1);

    res.json({
      level: user.level || 1,
      exp: user.exp || 0,
      currentLevelExp,
      nextLevelExp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard: top users by XP (basic weekly view)
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const XPAuditLog = require('../models/XPAuditLog');
    const User = require('../models/User');
    const start = new Date();
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    const leaderboard = await XPAuditLog.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: '$userId', weeklyXp: { $sum: '$amount' } } },
      { $sort: { weeklyXp: -1 } },
      { $limit: 10 }
    ]);

    const userIds = leaderboard.map((entry) => entry._id);
    const users = await User.find({ _id: { $in: userIds } }, 'name avatar xp level').lean();
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    const top = leaderboard.map((entry, index) => ({
      rank: index + 1,
      weeklyXp: entry.weeklyXp,
      ...(usersById.get(String(entry._id)) || { _id: entry._id, name: 'Unknown' })
    }));

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
