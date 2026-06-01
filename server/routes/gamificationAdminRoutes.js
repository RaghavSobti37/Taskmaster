const express = require('express');
const router = express.Router();
const GamificationConfig = require('../models/GamificationConfig');
const GamificationService = require('../services/gamificationService');
const { protect, admin } = require('../middleware/authMiddleware');

const ALLOWED_CONFIG_FIELDS = [
  'taskCompletion',
  'taskCreation',
  'projectCreation',
  'dailyLog',
  'attendanceLog',
  'attendanceDayBonus',
  'assetUpload',
  'leadCapture',
  'invoiceSubmission',
  'reviewApproval',
  'calendarEventCreated',
  'announcementCreated',
  'leaveApplied',
  'commentCreation',
  'dailyMissionBaseReward',
  'stepXp',
  'baseXp',
];

router.get('/rules', protect, admin, async (req, res) => {
  try {
    const config = await GamificationService.getConfig();
    res.json({
      config,
      rules: GamificationService.getRulesMetadata(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', protect, admin, async (req, res) => {
  try {
    const config = await GamificationService.getConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', protect, admin, async (req, res) => {
  try {
    const updates = req.body;
    let config = await GamificationConfig.findOne();
    if (!config) {
      config = new GamificationConfig();
    }

    ALLOWED_CONFIG_FIELDS.forEach((field) => {
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

router.get('/config/:field', protect, admin, async (req, res) => {
  try {
    const config = await GamificationService.getConfig();
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

router.post('/recalculate-all-levels', protect, admin, async (req, res) => {
  try {
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
