const express = require('express');
const router = express.Router();
const DailyMission = require('../models/DailyMission');
const GamificationService = require('../services/gamificationService');
const { protect } = require('../middleware/authMiddleware');

// Get daily missions for user
router.get('/missions', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const dateString = new Date().toISOString().split('T')[0];

    // Ensure missions are generated
    await GamificationService.generateDailyMissions(userId, tenantId);

    const missions = await DailyMission.find({ userId, date: dateString }).setOptions({ tenantId });
    res.json(missions);
  } catch (error) {
    console.error('Error fetching missions:', error);
    res.status(500).json({ error: 'Server error fetching daily missions' });
  }
});

// Claim a completed mission manually if needed (though the service auto-claims it)
// We might not need this if `progressMission` auto-claims, but some games require user to click "Claim"
router.post('/missions/:id/claim', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const missionId = req.params.id;

    const mission = await DailyMission.findOne({ _id: missionId, userId }).setOptions({ tenantId });
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    
    if (mission.completed) return res.status(400).json({ error: 'Mission already claimed' });

    if (mission.currentCount >= mission.targetCount) {
      mission.completed = true;
      await mission.save();
      const result = await GamificationService.awardExp(userId, tenantId, mission.expReward);
      return res.json({ mission, ...result });
    } else {
      return res.status(400).json({ error: 'Mission target not reached' });
    }
  } catch (error) {
    console.error('Error claiming mission:', error);
    res.status(500).json({ error: 'Server error claiming mission' });
  }
});

module.exports = router;
