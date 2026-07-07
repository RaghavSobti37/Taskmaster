const express = require('express');
const router = express.Router();
const GamificationConfig = require('../models/GamificationConfig');
const GamificationService = require('../services/gamificationService');
const logger = require('../utils/logger');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const gamificationAccess = requirePageAccess('admin_gamification');
const { validateBody } = require('../validation/validateBody');
const { gamificationConfigBody } = require('../validation/schemas/gamification');

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
  'baseXp',
];

router.get('/rules', protect, gamificationAccess, async (req, res) => {
  try {
    const config = await GamificationService.getConfigPlain();
    res.json({
      config,
      rules: GamificationService.getRulesMetadata(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', protect, gamificationAccess, async (req, res) => {
  try {
    const config = await GamificationService.getConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', protect, gamificationAccess, validateBody(gamificationConfigBody), async (req, res) => {
  try {
    const updates = req.body;
    let config = await GamificationConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = await GamificationService.ensureConfigForTenant();
    }

    const changedFields = [];
    const appliedFields = [];
    ALLOWED_CONFIG_FIELDS.forEach((field) => {
      if (field in updates && typeof updates[field] === 'number' && updates[field] >= 0) {
        appliedFields.push(field);
        if (config[field] !== updates[field]) {
          changedFields.push(field);
        }
        config[field] = updates[field];
      }
    });

    if (appliedFields.length === 0 && Object.keys(updates).length > 0) {
      const keys = Object.keys(updates).join(', ');
      return res.status(400).json({
        error: `No valid config fields updated. Check field names and use non-negative numbers (received: ${keys}).`,
      });
    }

    await config.save();

    const { totalUsers, updatedUsers, auditSync, duplicateRepair } =
      await GamificationService.recalculateAllUsersFromConfig();

    const unchangedUsers = totalUsers - updatedUsers;
    const effectiveRates = auditSync.configRates || {};
    let message;
    if (updatedUsers === 0 && auditSync.updatedLogs === 0) {
      if (changedFields.length > 0) {
        message = `Saved ${changedFields.join(', ')}. All ${totalUsers} users already match totals at the new rates (audit logs unchanged).`;
      } else {
        message = `No changes needed — all ${totalUsers} users and audit logs already match current config rates.`;
      }
    } else {
      const parts = [];
      if (changedFields.length > 0) {
        parts.push(`updated ${changedFields.join(', ')}`);
      }
      if (duplicateRepair?.removed > 0) {
        parts.push(`removed ${duplicateRepair.removed} duplicate XP audit rows`);
      }
      if (auditSync.updatedLogs > 0) {
        parts.push(`updated ${auditSync.updatedLogs} audit log entries`);
      }
      parts.push(`refreshed XP for all ${totalUsers} tenant users`);
      if (updatedUsers > 0) {
        parts.push(`${updatedUsers} had total XP changes`);
      }
      message = parts.join('; ');
    }

    logger.info('Gamification', 'Config saved', {
      changedFields,
      updatedAuditLogs: auditSync.updatedLogs,
      updatedUsers,
      configRates: auditSync.configRates,
    });

    const configPlain = await GamificationService.getConfigPlain();
    res.json({
      config: configPlain,
      recalc: {
        message,
        totalUsers,
        updatedUsers,
        unchangedUsers,
        updatedAuditLogs: auditSync.updatedLogs,
        changedFields,
        configRates: effectiveRates,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config/:field', protect, gamificationAccess, async (req, res) => {
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

router.post('/recalculate-all-levels', protect, gamificationAccess, async (req, res) => {
  try {
    const {
      totalUsers,
      updatedUsers,
      changes,
      auditSync,
      weeklyPreview,
      reviewExploitRepair,
      duplicateRepair,
      recalculatedAt,
    } = await GamificationService.recalculateAllUsersFromConfig();

    const unchanged = totalUsers - updatedUsers;
    let message;
    const effectiveRates = auditSync.configRates || {};
    const frozen = auditSync.hoursStats?.frozenStoredAmount || 0;
    if (
      updatedUsers === 0
      && auditSync.updatedLogs === 0
      && !reviewExploitRepair?.xp?.removedXpLogs
      && !(duplicateRepair?.removed > 0)
    ) {
      if (frozen > 0) {
        message = `No XP totals changed. ${frozen} time-based audit row(s) have no hours and no linked task/log — stored amounts kept. Link taskId/logId or re-award to apply new rates.`;
      } else {
        message = `No changes needed — all ${totalUsers} users and audit logs already match current config rates (using saved rates).`;
      }
    } else {
      const parts = [];
      if (reviewExploitRepair?.xp?.removedXpLogs) {
        parts.push(`removed ${reviewExploitRepair.xp.removedXpLogs} invalid review XP entries`);
      }
      if (duplicateRepair?.removed > 0) {
        parts.push(`removed ${duplicateRepair.removed} duplicate XP audit rows`);
      }
      if (auditSync.updatedLogs > 0) {
        parts.push(`updated ${auditSync.updatedLogs} audit log amounts`);
      }
      parts.push(`refreshed XP for all ${totalUsers} tenant users`);
      if (updatedUsers > 0) {
        parts.push(`${updatedUsers} had total XP changes`);
      }
      parts.push('leaderboard and progress history refreshed for all clients');
      message = `Recalculated using current config — ${parts.join('; ')}.`;
    }

    res.json({
      success: true,
      message,
      totalUsers,
      updatedUsers,
      unchangedUsers: unchanged,
      updatedAuditLogs: auditSync.updatedLogs,
      hoursStats: auditSync.hoursStats,
      recalculatedAt,
      reviewExploitRepair,
      configRates: effectiveRates,
      weeklyPreview: weeklyPreview?.entries?.map(([userId, weeklyXp]) => ({ userId, weeklyXp })),
      changes: changes.map((c) => ({
        userId: c.userId,
        exp: { from: c.prevExp, to: c.newExp },
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
