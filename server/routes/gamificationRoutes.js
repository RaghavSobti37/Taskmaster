const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const DailyMission = require('../models/DailyMission');
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { getCurrentWeekRange } = require('../utils/attendanceDate');
const { ACTION_LABELS } = require('../../shared/gamificationRules');

const toSimpleMessage = (log) => {
  const base = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase();
  if (log.action === 'MISSION_COMPLETE' && log.details?.title) {
    return `${base}: ${log.details.title}`;
  }
  if (log.action === 'ATTENDANCE_ACTION' && log.details?.date) {
    return `${base} (${log.details.date})`;
  }
  return base;
};

router.get('/missions', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await GamificationService.generateDailyMissions(req.user._id);

    const missions = await DailyMission.find({
      userId: req.user._id,
      date: { $gte: today },
    });

    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/progress', protect, async (req, res) => {
  try {
    const user = req.user;
    const currentLevelExp = await GamificationService.getExpForLevel(user.level || 1);
    const nextLevelExp = await GamificationService.getExpForLevel((user.level || 1) + 1);

    res.json({
      level: user.level || 1,
      exp: user.exp || 0,
      currentLevelExp,
      nextLevelExp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const weekly = await GamificationService.getWeeklyLeaderboard(10);

    const userIds = weekly.entries.map(([userId]) => userId);
    const users = await User.find({ _id: { $in: userIds } }, 'name avatar xp level').lean();
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    const top = weekly.entries.map(([userId, weeklyXp], index) => ({
      rank: index + 1,
      weeklyXp,
      ...(usersById.get(String(userId)) || { _id: userId, name: 'Unknown' }),
    }));

    logger.debug('Gamification', 'Leaderboard fetch', {
      weekStart: weekly.weekStartKey,
      weekEnd: weekly.weekEndKey,
      logCount: weekly.logCount,
      storedSum: weekly.storedSum,
      resolvedSum: weekly.resolvedSum,
      configTaskCompletion: weekly.configRates?.taskCompletion,
      top3: top.slice(0, 3).map((entry) => ({
        userId: entry._id,
        name: entry.name,
        weeklyXp: entry.weeklyXp,
      })),
      cacheHit: false,
    });

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard/:userId/breakdown', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const XPAuditLog = require('../models/XPAuditLog');
    const User = require('../models/User');
    const config = await GamificationService.getConfigPlain();
    const { weekStart, weekEnd, weekStartKey, weekEndKey } = getCurrentWeekRange();

    const logs = await XPAuditLog.find({
      userId,
      createdAt: { $gte: weekStart, $lte: weekEnd },
    })
      .sort({ createdAt: -1 })
      .lean();

    const user = await User.findById(userId, 'name avatar level xp').lean();

    const groupedMap = new Map();
    for (const log of logs) {
      const resolvedAmount = GamificationService.resolveLogAmount(config, log);
      const key = `${log.action}::${resolvedAmount}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          action: log.action,
          actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
          amountPerAction: resolvedAmount,
          count: 0,
          totalXp: 0,
          sampleMessage: toSimpleMessage(log),
        });
      }
      const group = groupedMap.get(key);
      group.count += 1;
      group.totalXp += resolvedAmount;
    }

    const groupedBreakdown = Array.from(groupedMap.values()).sort((a, b) => b.totalXp - a.totalXp);
    const totalXp = logs.reduce(
      (sum, item) => sum + GamificationService.resolveLogAmount(config, item),
      0
    );

    res.json({
      user: user || { _id: userId, name: 'Unknown' },
      weekStart,
      weekEnd,
      weekStartKey,
      weekEndKey,
      totalXp,
      groupedBreakdown,
      recentLogs: logs.slice(0, 15).map((log) => ({
        _id: log._id,
        amount: GamificationService.resolveLogAmount(config, log),
        action: log.action,
        actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
        message: toSimpleMessage(log),
        createdAt: log.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
