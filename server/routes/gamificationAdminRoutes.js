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

// Recalculate all users' XP from audit history using current config rates, then sync levels
router.post('/recalculate-all-levels', protect, admin, async (req, res) => {
  try {
    const GamificationService = require('../services/gamificationService');
    const config = await GamificationService.getConfig();
    const { totalUsers, updatedUsers, changes } = await GamificationService.recalculateAllUsersFromConfig();

    const unchanged = totalUsers - updatedUsers;
    let message;
    if (updatedUsers === 0) {
      message = `No changes needed — all ${totalUsers} users already match XP totals from activity history at current config rates.`;
    } else {
      message = `Recalculated XP for ${updatedUsers} of ${totalUsers} users using current config (stepXp: ${config.stepXp}).`;
    }

    res.json({
      success: true,
      message,
      totalUsers,
      updatedUsers,
      unchangedUsers: unchanged,
      stepXp: config.stepXp,
      changes: changes.map((c) => ({
        userId: c.userId,
        exp: { from: c.prevExp, to: c.newExp },
        level: { from: c.prevLevel, to: c.newLevel },
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
