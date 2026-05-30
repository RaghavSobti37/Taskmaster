const express = require('express');
const router = express.Router();
const GamificationConfig = require('../models/GamificationConfig');
const { protect, admin } = require('../middleware/authMiddleware');

// Get current gamification config (admin only — matches AdminRoute UI)
router.get('/config', protect, admin, async (req, res) => {
  try {
    let config = await GamificationConfig.findOne();
    
    if (!config) {
      config = await GamificationConfig.create({});
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update gamification config (admin only)
router.put('/config', protect, admin, async (req, res) => {
  try {
    const updates = req.body;

    let config = await GamificationConfig.findOne();
    if (!config) {
      config = new GamificationConfig();
    }

    // Whitelist fields that can be updated
    const allowedFields = [
      'taskCompletion',
      'taskCreation',
      'projectCreation',
      'dailyLog',
      'attendanceLog',
      'assetUpload',
      'commentCreation',
      'leadCapture',
      'invoiceSubmission',
      'dailyMissionBaseReward',
      'stepXp',
      'baseXp'
    ];

    allowedFields.forEach(field => {
      if (field in updates && typeof updates[field] === 'number' && updates[field] >= 0) {
        config[field] = updates[field];
      }
    });

    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single config field (admin only)
router.get('/config/:field', protect, admin, async (req, res) => {
  try {
    let config = await GamificationConfig.findOne();
    if (!config) {
      config = await GamificationConfig.create({});
    }

    const { field } = req.params;
    const value = config[field];

    if (value === undefined) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ field, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recalculate all users' levels with new formula
router.post('/recalculate-all-levels', protect, admin, async (req, res) => {
  try {
    const User = require('../models/User');
    const GamificationService = require('../services/gamificationService');

    const users = await User.find();
    let updateCount = 0;

    for (const user of users) {
      const currentLevel = await GamificationService.getLevelFromExp(user.exp || 0);
      if (currentLevel !== (user.level || 1)) {
        user.level = currentLevel;
        await user.save();
        updateCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Updated ${updateCount} users with new level formula`,
      totalUsers: users.length,
      updatedUsers: updateCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
