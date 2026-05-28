const express = require('express');
const router = express.Router();
const GamificationConfig = require('../models/GamificationConfig');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get current gamification config
router.get('/config', protect, async (req, res) => {
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
router.put('/config', protect, authorize('admin'), async (req, res) => {
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

// Get single config field
router.get('/config/:field', protect, async (req, res) => {
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

module.exports = router;
