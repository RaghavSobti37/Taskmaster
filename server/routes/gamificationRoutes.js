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

module.exports = router;
