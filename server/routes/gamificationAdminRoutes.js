const express = require('express');
const router = express.Router();
const GamificationConfig = require('../models/GamificationConfig');
const GamificationService = require('../services/gamificationService');
const logger = require('../utils/logger');
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

    const changedFields = [];
    ALLOWED_CONFIG_FIELDS.forEach((field) => {
      if (field in updates && typeof updates[field] === 'number' && updates[field] >= 0) {
        config[field] = updates[field];
        changedFields.push(field);
      }
    });

    await config.save();

    const { totalUsers, updatedUsers, auditSync } = await GamificationService.recalculateAllUsersFromConfig();

    const unchangedUsers = totalUsers - updatedUsers;
    let message;
    if (updatedUsers === 0 && auditSync.updatedLogs === 0) {
      message = `No changes needed — all ${totalUsers} users and audit logs already match current config rates.`;
    } else {
      const parts = [];
      if (changedFields.length > 0) {
        parts.push(`updated ${changedFields.join(', ')}`);
      }
      if (auditSync.updatedLogs > 0) {
        parts.push(`updated ${auditSync.updatedLogs} audit log entries`);
      }
      if (updatedUsers > 0) {
        parts.push(`synced XP/levels for ${updatedUsers} of ${totalUsers} users`);
      }
      message = parts.join('; ');
    }

    logger.info('Gamification', 'Config saved', {
      changedFields,
      updatedAuditLogs: auditSync.updatedLogs,
      updatedUsers,
      configRates: auditSync.configRates,
    });

    res.json({
      config,
      recalc: {
        message,
        totalUsers,
        updatedUsers,
        unchangedUsers,
        updatedAuditLogs: auditSync.updatedLogs,
        changedFields,
      },
    });
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
    const { totalUsers, updatedUsers, changes, auditSync, weeklyPreview } = await GamificationService.recalculateAllUsersFromConfig();

    const unchanged = totalUsers - updatedUsers;
    let message;
    if (updatedUsers === 0 && auditSync.updatedLogs === 0) {
      message = `No changes needed — all ${totalUsers} users and audit logs already match current config rates.`;
    } else {
      const parts = [];
      if (auditSync.updatedLogs > 0) {
        parts.push(`updated ${auditSync.updatedLogs} audit log entries`);
      }
      if (updatedUsers > 0) {
        parts.push(`synced XP/levels for ${updatedUsers} of ${totalUsers} users`);
      }
      message = `Recalculated using current config (stepXp: ${config.stepXp}) — ${parts.join('; ')}.`;
    }

    res.json({
      success: true,
      message,
      totalUsers,
      updatedUsers,
      unchangedUsers: unchanged,
      updatedAuditLogs: auditSync.updatedLogs,
      stepXp: config.stepXp,
      weeklyPreview: weeklyPreview?.entries?.map(([userId, weeklyXp]) => ({ userId, weeklyXp })),
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
